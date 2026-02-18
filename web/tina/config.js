import { defineConfig } from 'tinacms';

const branch =
  process.env.HEAD ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.TINA_BRANCH ||
  'main';

export default defineConfig({
  branch,
  clientId: process.env.TINA_CLIENT_ID || '',
  token: process.env.TINA_TOKEN || '',
  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },
  media: {
    tina: {
      mediaRoot: '',
      publicFolder: 'public',
    },
  },
  schema: {
    collections: [
      {
        name: 'mindmap',
        label: 'Mindmap',
        path: 'content/mindmap',
        format: 'json',
        ui: {
          allowedActions: { create: false, delete: false },
        },
        fields: [
          {
            name: 'nodes',
            label: 'Nodes',
            type: 'object',
            list: true,
            fields: [
              { name: 'id', label: 'ID', type: 'string' },
              { name: 'type', label: 'Type', type: 'string' },
              { name: 'parentNode', label: 'Parent Node ID', type: 'string' },
              { name: 'draggable', label: 'Draggable', type: 'boolean' },
              {
                name: 'data',
                label: 'Data',
                type: 'object',
                fields: [
                  { name: 'label', label: 'Label', type: 'string' },
                  { name: 'description', label: 'Description', type: 'string' },
                  { name: 'borderColor', label: 'Border Color', type: 'string' },
                  { name: 'backgroundColor', label: 'BG Color', type: 'string' },
                  { name: 'labelColor', label: 'Label Color', type: 'string' }
                ]
              },
              {
                name: 'position',
                label: 'Position',
                type: 'object',
                fields: [
                  { name: 'x', label: 'X', type: 'number' },
                  { name: 'y', label: 'Y', type: 'number' }
                ]
              },
              {
                 name: 'style',
                 label: 'Style',
                 type: 'object',
                 fields: [
                    { name: 'width', label: 'Width', type: 'number' },
                    { name: 'height', label: 'Height', type: 'number' },
                    { name: 'zIndex', label: 'Z-Index', type: 'number' }
                 ]
              }
            ]
          },
          {
            name: 'edges',
            label: 'Edges',
            type: 'object',
            list: true,
            fields: [
              { name: 'id', label: 'ID', type: 'string' },
              { name: 'source', label: 'Source Node', type: 'string' },
              { name: 'target', label: 'Target Node', type: 'string' },
              { name: 'label', label: 'Label', type: 'string' },
              { name: 'animated', label: 'Animated', type: 'boolean' },
              { name: 'type', label: 'Type', type: 'string' }
            ]
          },
        ],
      },
    ],
  },
});
