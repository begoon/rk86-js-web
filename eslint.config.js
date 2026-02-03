export default [
    {
        files: ["**/*.js"],
        rules: {
            "no-param-reassign": "error",
        },
        ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**", "*.min.js"],
    },
];
