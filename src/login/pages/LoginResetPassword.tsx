import type { ComponentType } from "react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import type { BomaTemplateProps } from "../Template";
import { Box, Button, Link, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const brandNode = (
    <Box sx={{ textAlign: "center" }}>
        <Typography
            variant="h4"
            sx={{ fontWeight: 900, color: "#0F4C5C", letterSpacing: 2, lineHeight: 1 }}
        >
            BOMA
        </Typography>
        <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: "#E07A2F", letterSpacing: 4, fontSize: "0.75rem" }}
        >
            REAL ESTATE
        </Typography>
    </Box>
);

export default function LoginResetPassword(
    props: PageProps<Extract<KcContext, { pageId: "login-reset-password.ftl" }>, I18n>
) {
    const { kcContext, i18n, doUseDefaultCss, Template: BaseTemplate, classes } = props;
    const Template = BaseTemplate as ComponentType<BomaTemplateProps>;

    const { url, realm, auth, messagesPerField } = kcContext;

    const { msg, msgStr } = i18n;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!messagesPerField.existsError("username")}
            headerNode={msg("emailForgotTitle")}
            logoNode={brandNode}
        >
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                {realm.duplicateEmailsAllowed
                    ? msg("emailInstructionUsername")
                    : msg("emailInstruction")}
            </Typography>

            <form action={url.loginAction} method="post">
                <TextField
                    fullWidth
                    id="username"
                    name="username"
                    label={
                        !realm.loginWithEmailAllowed
                            ? msgStr("username")
                            : !realm.registrationEmailAsUsername
                              ? msgStr("usernameOrEmail")
                              : msgStr("email")
                    }
                    defaultValue={auth.attemptedUsername ?? ""}
                    autoFocus
                    error={messagesPerField.existsError("username")}
                    helperText={
                        messagesPerField.existsError("username")
                            ? messagesPerField.get("username")
                            : undefined
                    }
                    sx={{ mb: 3 }}
                />

                <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    sx={{
                        py: 1.5,
                        background: "linear-gradient(90deg, #0F4C5C, #E07A2F)",
                        "&:hover": { background: "linear-gradient(90deg, #0A3540, #B85F1F)" },
                        boxShadow: "0 4px 14px rgba(27,107,58,0.4)",
                        mb: 2,
                    }}
                >
                    {msgStr("doSubmit")}
                </Button>

                <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Link
                        href={url.loginUrl}
                        underline="hover"
                        color="secondary"
                        variant="body2"
                        sx={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                        <ArrowBackIcon fontSize="small" />
                        {msg("backToLogin")}
                    </Link>
                </Box>
            </form>
        </Template>
    );
}
