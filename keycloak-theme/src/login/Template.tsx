import { useEffect } from "react";
import { useInitialize } from "keycloakify/login/Template.useInitialize";
import type { TemplateProps } from "keycloakify/login/TemplateProps";
import type { I18n } from "./i18n";
import type { KcContext } from "./KcContext";
import type { ReactNode } from "react";
import {
    Box,
    Card,
    CardContent,
    Typography,
    Alert,
    CircularProgress,
    Link,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Brand from "./Brand";

const bomaTheme = createTheme({
    palette: {
        primary: { main: "#0F4C5C", light: "#1C6E80", dark: "#0A3540" },
        secondary: { main: "#E07A2F", light: "#F09A55", dark: "#B85F1F" },
        background: { default: "#f2f6f7" },
    },
    typography: {
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    shape: { borderRadius: 10 },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 600,
                    "&.MuiButton-containedPrimary": { boxShadow: "none" },
                    "&.MuiButton-containedPrimary:hover": {
                        backgroundColor: "#0A3540",
                        boxShadow: "0 6px 16px rgba(10,53,64,0.25)",
                    },
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#0F4C5C",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#0F4C5C",
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    "&.Mui-focused": { color: "#0F4C5C" },
                },
            },
        },
    },
});

export type BomaTemplateProps = TemplateProps<KcContext, I18n> & {
    logoNode?: ReactNode;
};

export default function Template(props: BomaTemplateProps) {
    const {
        displayMessage = true,
        displayInfo = false,
        headerNode,
        infoNode = null,
        logoNode,
        kcContext,
        i18n: _i18n,
        doUseDefaultCss,
        children,
    } = props;

    const { message, client } = kcContext;
    const homeUrl = "baseUrl" in client ? client.baseUrl : undefined;

    useEffect(() => {
        document.title = "BOMA Real Estate";
    }, []);

    const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });

    if (!isReadyToRender) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
                <CircularProgress sx={{ color: "#0F4C5C" }} />
            </Box>
        );
    }

    return (
        <ThemeProvider theme={bomaTheme}>
            <CssBaseline />
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 2,
                    backgroundColor: "#0F4C5C",
                    backgroundImage:
                        "radial-gradient(ellipse at top right, #39818a 0%, transparent 60%), radial-gradient(ellipse at bottom left, #0A3540 0%, transparent 55%)",
                    px: 2,
                    py: 4,
                }}
            >
                <Card
                    elevation={0}
                    sx={{
                        width: "100%",
                        maxWidth: 460,
                        borderRadius: 4,
                        overflow: "hidden",
                        boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
                    }}
                >
                    <Box sx={{ height: 4, bgcolor: "#E07A2F" }} />
                    <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                        {/* Branding / logo */}
                        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
                            {logoNode ?? <Brand />}
                        </Box>

                        {/* Page title */}
                        {headerNode && (
                            <Typography
                                variant="h5"
                                component="h1"
                                align="center"
                                sx={{ fontWeight: 700, fontSize: "1.35rem", color: "#14262B", mb: 3 }}
                            >
                                {headerNode}
                            </Typography>
                        )}

                        {/* Error / info / success banner */}
                        {displayMessage && message !== undefined && (
                            <Alert
                                severity={
                                    message.type === "error"
                                        ? "error"
                                        : message.type === "warning"
                                          ? "warning"
                                          : message.type === "success"
                                            ? "success"
                                            : "info"
                                }
                                sx={{ mb: 2, borderRadius: 2 }}
                            >
                                <span dangerouslySetInnerHTML={{ __html: message.summary }} />
                            </Alert>
                        )}

                        {children}

                        {displayInfo && infoNode && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                align="center"
                                sx={{ mt: 2 }}
                            >
                                {infoNode}
                            </Typography>
                        )}
                    </CardContent>
                </Card>

                {homeUrl && (
                    <Link
                        href={homeUrl}
                        underline="hover"
                        sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.875rem" }}
                    >
                        ← Back to BOMA
                    </Link>
                )}
            </Box>
        </ThemeProvider>
    );
}
