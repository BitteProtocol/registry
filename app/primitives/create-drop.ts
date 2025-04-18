import { z } from 'zod';
import {
  BitteTool,
  CreateTokenDrop,
  DbTokenDrop,
  TokenDropsOwned,
} from '@/lib/types';
import { collectionWithConverter, write } from '@/lib/firestore';
import { BITTE_WALLET_URL } from '@/app/config';
import { uploadReference } from '@mintbase-js/storage';
import { FunctionCallAction } from '@near-wallet-selector/core';
import { FieldValue, Timestamp } from '@google-cloud/firestore';
import { getErrorMsg } from '@/lib/error';
import { generateId } from 'ai';

const DROPS_OPEN_CONTRACT = 'drops.mintbase1.near';
const DROPS_PROXY_CONTRACT = '0.drop.proxy.mintbase.near';
const TOKEN_DROP_COLLECTION = 'dropIds';
export const TOKEN_DROP_OWNERS_COLLECTION = 'dropOwners';

type CreateDropParams = {
  name: string;
  description: string;
  accountId: string;
  mediaHash: string;
};

const CREATE_TOKEN_DROP_SCHEMA: z.ZodType<CreateTokenDrop> = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  creator: z.string().min(1, 'Creator is required'),
  contract_id: z.string().min(1, 'Contract ID is required'),
  media: z.string().min(1, 'Media is required'),
});

export const createDrop: BitteTool<CreateDropParams, string> = {
  toolSpec: {
    function: {
      name: 'create-drop',
      description: `Creates an NFT drop with a previous generated image. If not image was generated, ask the user to do so before proceeding with creating a drop. If the user does not provide a title and description, you can generate those based on the conversation.`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Name for the token drop. If not provided, generate one.',
          },
          description: {
            type: 'string',
            description:
              'Description for the token drop. If not provided, generate one.',
          },
          accountId: {
            type: 'string',
            description: 'Account ID of the user creating the drop.',
          },
          mediaHash: {
            type: 'string',
            description: 'Arweave media hash from the generated image.',
          },
        },
        required: ['name', 'description', 'accountId', 'mediaHash'],
      },
    },
    type: 'function',
  },
  execute: async ({ name, description, accountId, mediaHash }) => {
    try {
      const dropId = generateDropSlug({
        name,
        accountId,
      });

      await createTokenDrop({
        id: dropId,
        name,
        description,
        creator: accountId,
        media: mediaHash,
        contract_id: DROPS_OPEN_CONTRACT,
        accountId,
      });

      return { data: dropId };
    } catch (error) {
      return { error: getErrorMsg(error) };
    }
  },
};

export const createTokenDrop = async (
  createTokenDrop: CreateTokenDrop & { accountId: string },
): Promise<string> => {
  const parsed = CREATE_TOKEN_DROP_SCHEMA.safeParse(createTokenDrop);
  if (!parsed.success) {
    throw new Error(
      `Invalid create token drop payload: ${parsed.error.message}`,
    );
  }
  const { name, description, media, id, contract_id } = createTokenDrop;

  const claimDescription = `${description} mint this on ${BITTE_WALLET_URL}/claim/${id}`;
  const { id: referenceId } = await uploadReference({
    id,
    name,
    description: claimDescription,
    media,
    creatorAddress: createTokenDrop.accountId,
    metadata_content_flag: 'tokenDrop',
  });

  const action: FunctionCallAction = {
    type: 'FunctionCall',
    params: {
      methodName: 'mint',
      args: {
        metadata: JSON.stringify({
          id,
          title: name || id,
          description: claimDescription,
          media,
          reference: referenceId,
        }),
        nft_contract_id: contract_id,
      },
      gas: '200000000000000',
      deposit: '14500000000000000000000',
    },
  };

  const encodedTxArgs = `[${encodeURIComponent(
    JSON.stringify({
      receiverId: DROPS_PROXY_CONTRACT,
      actions: [action],
    }),
  )}]`;

  const tokenDropPayload: DbTokenDrop = {
    ...createTokenDrop,
    transactionUrl: encodedTxArgs,
    description: claimDescription,
    reference: referenceId,
    proxy: DROPS_PROXY_CONTRACT,
    enabled: true,
    total_minted: 0,
    start_date: Timestamp.now(),
  };

  const dropOwnersPayload = {
    drops: FieldValue.arrayUnion(createTokenDrop.id),
  };

  const [tokenDropResult] = await Promise.all([
    write<DbTokenDrop>(
      TOKEN_DROP_COLLECTION,
      createTokenDrop.id,
      tokenDropPayload,
    ),
    collectionWithConverter<TokenDropsOwned>(TOKEN_DROP_OWNERS_COLLECTION)
      .doc(createTokenDrop.accountId)
      .set(dropOwnersPayload, { merge: true }),
  ]);

  if (!tokenDropResult.success) {
    throw new Error('Failed to create token drop');
  }

  return referenceId;
};

export const generateDropSlug = ({
  name,
  accountId,
}: {
  name: string;
  accountId: string;
}): string => {
  return `${sanitizeValue(name)}-by-${sanitizeValue(accountId)}:${generateId(5)}`;
};

const MIN_LENGTH = 5;

function sanitizeValue(input: string): string {
  const sanitizedInput = input
    .toLowerCase()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/[^a-z0-9\-.:]/g, ''); // remove unsupported characters

  const numLostCharacters = MIN_LENGTH - sanitizedInput.length;

  return numLostCharacters > 0
    ? sanitizedInput + generateId(numLostCharacters)
    : sanitizedInput;
}
