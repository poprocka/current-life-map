import { build } from "esbuild";
import path from "path";
const root = path.resolve(".");
const globals = { name: "globals", setup(b) {
  b.onResolve({ filter: /^react(-dom)?(\/client)?$/ }, (a) => ({ path: a.path, namespace: "g" }));
  b.onLoad({ filter: /.*/, namespace: "g" }, (a) => ({ contents: `module.exports = ${a.path.startsWith("react-dom") ? "ReactDOM" : "React"};`, loader: "js" }));
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(root, "preview/shims/link.tsx") }));
  b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(root, "preview/shims/navigation.ts") }));
  b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: "empty" }));
  b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "", loader: "js" }));
}};
await build({ entryPoints: ["preview/main.tsx"], bundle: true, minify: true, format: "iife", outfile: "preview/out/app.js",
  jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment", inject: ["preview/react-inject.js"],
  alias: { "@": "./src" }, plugins: [globals], define: { "process.env.NODE_ENV": '"production"' }, target: "es2019" });
