// tina/config.js
import { defineConfig } from "tinacms";
var branch = process.env.HEAD || process.env.VERCEL_GIT_COMMIT_REF || process.env.TINA_BRANCH || "main";
var config_default = defineConfig({
  branch,
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",
  build: {
    outputFolder: "admin",
    publicFolder: "public"
  },
  media: {
    tina: {
      // ✅ CORRECT: Files will upload to public/arkiv/ (your symlink to external drive)
      mediaRoot: "arkiv",
      publicFolder: "public"
    }
  },
  schema: {
    collections: [
      {
        name: "mindmap",
        label: "Mindmap",
        path: "content/mindmap",
        format: "json",
        ui: {
          allowedActions: { create: false, delete: false }
        },
        fields: [
          {
            name: "nodes",
            label: "Nodes",
            type: "object",
            list: true,
            fields: [
              { name: "id", label: "ID", type: "string" },
              { name: "type", label: "Type", type: "string" },
              { name: "parentNode", label: "Parent Node ID", type: "string" },
              { name: "draggable", label: "Draggable", type: "boolean" },
              {
                name: "data",
                label: "Data",
                type: "object",
                fields: [
                  { name: "label", label: "Label", type: "string" },
                  { name: "description", label: "Description", type: "string" },
                  { name: "borderColor", label: "Border Color", type: "string" },
                  { name: "backgroundColor", label: "BG Color", type: "string" },
                  { name: "labelColor", label: "Label Color", type: "string" }
                ]
              },
              {
                name: "position",
                label: "Position",
                type: "object",
                fields: [
                  { name: "x", label: "X", type: "number" },
                  { name: "y", label: "Y", type: "number" }
                ]
              },
              {
                name: "style",
                label: "Style",
                type: "object",
                fields: [
                  { name: "width", label: "Width", type: "number" },
                  { name: "height", label: "Height", type: "number" },
                  { name: "zIndex", label: "Z-Index", type: "number" }
                ]
              }
            ]
          },
          {
            name: "edges",
            label: "Edges",
            type: "object",
            list: true,
            fields: [
              { name: "id", label: "ID", type: "string" },
              { name: "source", label: "Source Node", type: "string" },
              { name: "target", label: "Target Node", type: "string" },
              { name: "label", label: "Label", type: "string" },
              { name: "animated", label: "Animated", type: "boolean" },
              { name: "type", label: "Type", type: "string" }
            ]
          }
        ]
      },
      {
        name: "resources",
        label: "Resources",
        path: "content/resources",
        format: "mdx",
        ui: {
          // ✅ CORRECT: Users can create, delete, and rename resources
          allowedActions: { create: true, delete: true, rename: true }
        },
        fields: [
          { name: "title", label: "Title", type: "string", required: true },
          {
            name: "type",
            label: "Type",
            type: "string",
            required: true,
            options: ["Document", "Video", "Link"]
          },
          {
            name: "file",
            label: "File",
            type: "string",
            ui: { component: "file" },
            description: "Upload a file (will be stored in /arkiv/)"
          },
          {
            name: "videoUrl",
            label: "Video URL",
            type: "string",
            description: "For Video type: YouTube, Vimeo, or direct video URL"
          },
          {
            name: "thumbnail",
            label: "Thumbnail",
            type: "image",
            description: "Optional preview image (will be stored in /arkiv/)"
          },
          {
            name: "description",
            label: "Description",
            type: "rich-text",
            description: "Optional description shown on the card"
          }
        ]
      }
    ]
  }
});
export {
  config_default as default
};
