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

export const MINDMAP_QUERY = `
  query Mindmap($relativePath: String!) {
    mindmap(relativePath: $relativePath) {
      nodes {
        id
        type
        parentNode
        draggable
        data {
          label
          description
          borderColor
          backgroundColor
          labelColor
        }
        position {
          x
          y
        }
        style {
          width
          height
          zIndex
        }
      }
      edges {
        id
        source
        target
        label
        animated
        type
      }
    }
  }
`;

export const UPDATE_MINDMAP_MUTATION = `
  mutation UpdateMindmap($relativePath: String!, $data: MindmapMutation!) {
    updateMindmap(relativePath: $relativePath, params: $data) {
      nodes {
        id
        type
        parentNode
        draggable
        data {
          label
          description
          borderColor
          backgroundColor
          labelColor
        }
        position {
          x
          y
        }
        style {
          width
          height
          zIndex
        }
      }
      edges {
        id
        source
        target
        label
        animated
        type
      }
    }
  }
`;
