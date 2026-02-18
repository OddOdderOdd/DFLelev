export function gql(strings, ...args) {
  let str = "";
  strings.forEach((string, i) => {
    str += string + (args[i] || "");
  });
  return str;
}
export const MindmapPartsFragmentDoc = gql`
    fragment MindmapParts on Mindmap {
  __typename
  nodes {
    __typename
    id
    type
    parentNode
    draggable
    data {
      __typename
      label
      description
      borderColor
      backgroundColor
      labelColor
    }
    position {
      __typename
      x
      y
    }
    style {
      __typename
      width
      height
      zIndex
    }
  }
  edges {
    __typename
    id
    source
    target
    label
    animated
    type
  }
}
    `;
export const ResourcesPartsFragmentDoc = gql`
    fragment ResourcesParts on Resources {
  __typename
  title
  type
  file
  videoUrl
  thumbnail
  description
}
    `;
export const MindmapDocument = gql`
    query mindmap($relativePath: String!) {
  mindmap(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...MindmapParts
  }
}
    ${MindmapPartsFragmentDoc}`;
export const MindmapConnectionDocument = gql`
    query mindmapConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: MindmapFilter) {
  mindmapConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...MindmapParts
      }
    }
  }
}
    ${MindmapPartsFragmentDoc}`;
export const ResourcesDocument = gql`
    query resources($relativePath: String!) {
  resources(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...ResourcesParts
  }
}
    ${ResourcesPartsFragmentDoc}`;
export const ResourcesConnectionDocument = gql`
    query resourcesConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: ResourcesFilter) {
  resourcesConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...ResourcesParts
      }
    }
  }
}
    ${ResourcesPartsFragmentDoc}`;
export function getSdk(requester) {
  return {
    mindmap(variables, options) {
      return requester(MindmapDocument, variables, options);
    },
    mindmapConnection(variables, options) {
      return requester(MindmapConnectionDocument, variables, options);
    },
    resources(variables, options) {
      return requester(ResourcesDocument, variables, options);
    },
    resourcesConnection(variables, options) {
      return requester(ResourcesConnectionDocument, variables, options);
    }
  };
}
import { createClient } from "tinacms/dist/client";
const generateRequester = (client) => {
  const requester = async (doc, vars, options) => {
    let url = client.apiUrl;
    if (options?.branch) {
      const index = client.apiUrl.lastIndexOf("/");
      url = client.apiUrl.substring(0, index + 1) + options.branch;
    }
    const data = await client.request({
      query: doc,
      variables: vars,
      url
    }, options);
    return { data: data?.data, errors: data?.errors, query: doc, variables: vars || {} };
  };
  return requester;
};
export const ExperimentalGetTinaClient = () => getSdk(
  generateRequester(
    createClient({
      url: "http://localhost:4001/graphql",
      queries
    })
  )
);
export const queries = (client) => {
  const requester = generateRequester(client);
  return getSdk(requester);
};
