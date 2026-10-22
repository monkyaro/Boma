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
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const bomaTheme = createTheme({
    palette: {
        primary: { main: "#0F4C5C", light: "#1C6E80", dark: "#0A3540" },
        secondary: { main: "#E07A2F", light: "#F09A55", dark: "#B85F1F" },
        background: { default: "#f2f6f7" },
    },
    typography: {
        fontFamily: "'Inter', 'Roboto', sans-serif",
    },
    shape: { borderRadius: 10 },
    components: {
        MuiButton: {
            styleOverrides: {
                root: { textTransform: "none", fontWeight: 600 },
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

    const { message } = kcContext;

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
                    background: "linear-gradient(135deg, #0A3540 0%, #0F4C5C 60%, #1C6E80 100%)",
                    p: 2,
                }}
            >
                <Card
                    elevation={0}
                    sx={{
                        width: "100%",
                        maxWidth: 460,
                        borderRadius: 3,
                        overflow: "visible",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.30)",
                    }}
                >
                    {/* Top accent bar — teal to terracotta */}
                    <Box
                        sx={{
                            height: 5,
                            background: "linear-gradient(90deg, #0F4C5C, #E07A2F)",
                            borderRadius: "10px 10px 0 0",
                        }}
                    />

                    <CardContent sx={{ p: 4 }}>
                        {/* Branding / logo */}
                        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
                            {logoNode ?? (
                                <Typography
                                    variant="h4"
                                    sx={{ fontWeight: 900, color: "#0F4C5C", letterSpacing: 2 }}
                                >
                                    BOMA
                                </Typography>
                            )}
                        </Box>

                        {/* Page title */}
                        {headerNode && (
                            <Typography
                                variant="h5"
                                color="primary"
                                align="center"
                                sx={{ fontWeight: 700, letterSpacing: "-0.3px", mb: 3 }}
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
            </Box>
        </ThemeProvider>
    );
}
