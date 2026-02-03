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
        }
      }
    }
  }
`;
