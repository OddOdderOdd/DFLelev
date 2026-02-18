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
      mediaRoot: 'uploads',
      publicFolder: 'public',
    },
  },
  schema: {
    collections: [
      {
        name: 'resources',
        label: 'Resources',
        path: 'content/resources',
        format: 'mdx',
        ui: {
          allowedActions: {
            create: true,
            delete: true,
            rename: true,
          },
        },
        fields: [
          {
            name: 'title',
            label: 'Title',
            type: 'string',
            required: true,
          },
          {
            name: 'type',
            label: 'Type',
            type: 'string',
            required: true,
            options: [
              { label: 'Document', value: 'Document' },
              { label: 'Video', value: 'Video' },
              { label: 'Link', value: 'Link' },
            ],
          },
          {
            name: 'file',
            label: 'File',
            type: 'string',
            ui: {
              component: 'file',
            },
          },
          {
            name: 'videoUrl',
            label: 'Video URL',
            type: 'string',
          },
          {
            name: 'thumbnail',
            label: 'Thumbnail',
            type: 'image',
          },
          {
            name: 'description',
            label: 'Description',
            type: 'rich-text',
          },
        ],
      },
    ],
  },
});
