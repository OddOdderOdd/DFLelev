import { createClient } from 'tinacms/dist/client';

export const tinaClient = createClient({
  url: import.meta.env.VITE_TINA_GRAPHQL_URL || 'http://localhost:4001/graphql',
  token: import.meta.env.VITE_TINA_TOKEN || '',
  queries: () => ({}),
});

export const RESOURCES_QUERY = `
  query ResourcesConnection {
    resourcesConnection {
      edges {
        node {
          id
          title
          type
          file
          videoUrl
          thumbnail
          description
          _sys {
            relativePath
          }
        }
      }
    }
  }
`;

export const MINDMAP_QUERY = `
  query MindmapDocument($relativePath: String!) {
    mindmap(relativePath: $relativePath) {
      nodes
      edges
    }
  }
`;

export const UPDATE_MINDMAP_MUTATION = `
  mutation UpdateMindmapDocument($relativePath: String!, $data: MindmapUpdateInput!) {
    updateMindmapDocument(relativePath: $relativePath, params: { data: $data }) {
      data {
        nodes
        edges
      }
    }
  }
`;

export const DELETE_RESOURCE_MUTATION = `
  mutation DeleteResourceDocument($relativePath: String!) {
    deleteResourcesDocument(relativePath: $relativePath) {
      __typename
    }
  }
`;
