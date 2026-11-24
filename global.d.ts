// Lets TypeScript accept side-effect imports of CSS files,
// such as `import "@xyflow/react/dist/style.css"`. Next.js bundles the CSS itself.
declare module "*.css";