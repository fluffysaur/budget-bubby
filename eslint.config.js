import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
    {
        ignores: [
            "dist",
            ".worktrees",
            "supabase/functions/_shared/dist",
            "node_modules",
            "playwright-report",
            "test-results",
            "*.tsbuildinfo",
        ],
    },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ["**/*.{ts,tsx}"],
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-hooks/set-state-in-effect": "off",
            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true },
            ],
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
    {
        // Amounts must use the shared money type scale (see src/lib/moneyStyles.ts)
        files: ["src/**/*.tsx"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector:
                        "JSXElement > JSXExpressionContainer > CallExpression[callee.name='formatSGD']",
                    message:
                        'Render amounts with <CurrencyText amount={...} size="..." /> instead of {formatSGD(...)}.',
                },
                {
                    selector:
                        "JSXFragment > JSXExpressionContainer > CallExpression[callee.name='formatSGD']",
                    message:
                        'Render amounts with <CurrencyText amount={...} size="..." /> instead of {formatSGD(...)}.',
                },
            ],
        },
    },
    {
        files: ["src/context/**/*.{ts,tsx}"],
        rules: {
            "react-refresh/only-export-components": "off",
        },
    },
    {
        files: ["tests/**/*.{ts,tsx}"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
);
