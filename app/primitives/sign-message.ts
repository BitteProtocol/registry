import type { BitteTool, SignMessageParams, SignMessageResult } from '@/lib/types';

export const signMessage: BitteTool<SignMessageParams, SignMessageResult> = {
  toolSpec: {
    function: {
      name: 'sign-message',
      description:
        'Sign a message with a NEAR wallet and return a signed payload containing accountId, publicKey, signature, message, nonce, recipient, callbackUrl and state. The signature is cryptographically secure and can be verified by the recipient.',
      parameters: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            description: 'The message to be signed.',
          },
          recipient: {
            type: 'string',
            description:
              'The recipient of the signature request. If not provided, the connected wallet will be used.',
          },
          nonce: {
            type: 'string',
            description:
              'A challenge nonce string to be used in the signature. Converted to a buffer and hashed before signing. Randomly generated if not provided.',
          },
          callbackUrl: {
            type: 'string',
            description:
              'An optional callback URL that can be used to verify the signature.',
          },
        },
      },
    },
    type: 'function',
  },
};
