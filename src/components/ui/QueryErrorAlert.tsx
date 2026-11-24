import { Alert } from "./Alert";
import { Button } from "./Button";

export interface QueryErrorAlertProps {
    error?: unknown;
    onRetry: () => void;
    title?: string;
    className?: string;
}

export function QueryErrorAlert({
    error,
    onRetry,
    title = "Couldn't load",
    className,
}: QueryErrorAlertProps) {
    const message =
        error instanceof Error && error.message
            ? error.message
            : "Check your connection and try again.";

    return (
        <Alert
            variant="danger"
            title={title}
            className={className}
            action={
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onRetry}
                >
                    Retry
                </Button>
            }
        >
            {message}
        </Alert>
    );
}

export default QueryErrorAlert;
