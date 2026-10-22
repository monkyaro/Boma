import type { ComponentType } from "react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import type { BomaTemplateProps } from "../Template";
import { Box, Button, Link, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";


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
                        mb: 2,
                    }}
                >
                    {msgStr("doSubmit")}
                </Button>

                <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Link
                        href={url.loginUrl}
                        underline="hover"
                        color="secondary.dark"
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
