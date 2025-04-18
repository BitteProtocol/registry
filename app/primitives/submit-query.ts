import { getErrorMsg } from '@/lib/error';
import { BitteTool, GqlFetchResult, NearNetworkId } from '@/lib/types';

export const GRAPH_ENDPOINTS = {
  mainnet: 'https://graph.mintbase.xyz/',
  testnet: 'https://graph.mintbase.xyz/testnet',
};

type SubmitQueryParams = {
  query: string;
  network: NearNetworkId;
};

export const submitQuery: BitteTool<
  SubmitQueryParams,
  GqlFetchResult<unknown>
> = {
  toolSpec: {
    function: {
      name: 'submit-query',
      description: `Generate and submit GraphQL queries based on schema.
      - Limit results to 5 unless specified (max 20)
      - Fetch aggregations with '<field-name>_aggregate'
      - Always fetch 'metadata_id' for NFTs
      - Use model/view names as main query fields
      - Include relevant fields in selection set

      Example:
      query FetchRecentListings {
        mb_views_active_listings(order_by: {created_at: desc}, limit: 5) {
          media title price created_at nft_contract_id token_id metadata_id
        }
      }
      `,
      parameters: {
        type: 'object',
        required: ['query', 'network'],
        properties: {
          query: {
            type: 'string',
            description: `GraphQL query based on this schema:
            SharedNFTFields: nft_contract_id, token_id, receipt_id, timestamp, reference, reference_hash, media, media_hash, title, description, extra, content_flag
            SharedContractFields: name, symbol, icon, spec, base_uri, owner_id, is_mintbase

            Models:
            mb_store_minters: {...SharedNFTFields, minter_id}
            nft_approvals: {...SharedNFTFields, approved_account_id, approval_id}
            nft_attributes: {nft_metadata_id, ...SharedNFTFields, attribute_type, attribute_value, attribute_display_type}
            nft_contracts: {id, ...SharedContractFields, reference, reference_hash, created_at, created_receipt_id, content_flag, category}
            nft_metadata: {id, ...SharedNFTFields, reference_blob, minter}

            Views:
            mb_views_nft_metadata: {id, ...SharedNFTFields, ...SharedContractFields, reference_blob, metadata_content_flag, nft_contract_reference, nft_contract_created_at, nft_contract_content_flag}
            mb_views_active_listings: {...SharedNFTFields, market_id, approval_id, created_at, kind, price, currency, listed_by, metadata_id, minter, reference_blob}
            mb_views_nft_tokens: {...SharedNFTFields, ...SharedContractFields, owner, mint_memo, last_transfer_timestamp, last_transfer_receipt_id, minted_timestamp, minted_receipt_id, burned_timestamp, burned_receipt_id, minter, copies, issued_at, expires_at, starts_at, updated_at, metadata_id, reference_blob, metadata_content_flag, nft_contract_reference, nft_contract_created_at, nft_contract_content_flag, royalties_percent, royalties, splits}
            mb_views_nft_tokens_with_listing: {...SharedNFTFields, owner, metadata_id, price, currency, reference_blob}
            mb_views_active_listings_by_contract: {...SharedNFTFields, market_id, approval_id, price, currency, created_at, metadata_id, listed_by, total_listings}`,
          },
          network: {
            type: 'string',
            enum: ['testnet', 'mainnet'],
            default: 'mainnet',
            description: 'Network to query.',
          },
        },
      },
    },
    type: 'function',
  },
  execute: async ({ query, network }: SubmitQueryParams) => {
    const mintbaseGraphUrl = GRAPH_ENDPOINTS[network];

    try {
      const request = await fetch(mintbaseGraphUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mb-api-key': 'omni-site',
        },
        body: JSON.stringify({
          query,
          network,
        }),
      });

      const queryResponse: GqlFetchResult<unknown> = await request.json();

      const queryData = queryResponse.data;

      if (queryData) {
        return {
          data: queryData,
        };
      }

      return {
        error: queryResponse.error || 'Query returned no data or error',
      };
    } catch (error) {
      return {
        error: getErrorMsg(error),
      };
    }
  },
};
