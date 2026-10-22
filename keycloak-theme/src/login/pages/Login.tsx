import { useState } from "react";
import type { ComponentType } from "react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import type { BomaTemplateProps } from "../Template";
import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Link,
    TextField,
    Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";


export default function Login(props: PageProps<Extract<KcContext, { pageId: "login.ftl" }>, I18n>) {
    const { kcContext, i18n, doUseDefaultCss, Template: BaseTemplate, classes } = props;
    const Template = BaseTemplate as ComponentType<BomaTemplateProps>;

    const { social, realm, url, usernameHidden, login, auth, registrationDisabled, messagesPerField } = kcContext;

    const { msg, msgStr } = i18n;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!messagesPerField.existsError("username", "password")}
            headerNode={msg("loginAccountTitle")}
            displayInfo={realm.password && realm.registrationAllowed && !registrationDisabled}
            infoNode={
                <span>
                    {msg("noAccount")}{" "}
                    <Link href={url.registrationUrl} underline="hover" color="secondary.dark" sx={{ fontWeight: 600 }}>
                        {msg("doRegister")}
                    </Link>
                </span>
            }
        >
            {/* Social providers */}
            {realm.password && social?.providers !== undefined && social.providers.length !== 0 && (
                <Box sx={{ mb: 2 }}>
                    {social.providers.map(p => (
                        <Button
                            key={p.alias}
                            fullWidth
                            variant="outlined"
                            href={p.loginUrl}
                            sx={{ mb: 1, borderColor: "#d0d5dd", color: "#344054" }}
                        >
                            {p.displayName}
                        </Button>
                    ))}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 2 }}>
                        <Box sx={{ flex: 1, height: "1px", bgcolor: "#e0e0e0" }} />
                        <Typography variant="body2" color="text.secondary">or</Typography>
                        <Box sx={{ flex: 1, height: "1px", bgcolor: "#e0e0e0" }} />
                    </Box>
                </Box>
            )}

            <form onSubmit={() => setIsSubmitting(true)} action={url.loginAction} method="post">
                {/* Username / Email */}
                {!usernameHidden && (
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
                        defaultValue={login.username ?? ""}
                        autoFocus
                        autoComplete="username"
                        error={messagesPerField.existsError("username", "password")}
                        helperText={
                            messagesPerField.existsError("username", "password")
                                ? messagesPerField.getFirstError("username", "password")
                                : undefined
                        }
                        sx={{ mb: 2 }}
                    />
                )}

                {/* Password */}
                <TextField
                    fullWidth
                    variant="outlined"
                    id="password"
                    name="password"
                    label={msgStr("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    error={messagesPerField.existsError("username", "password")}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => setShowPassword(v => !v)}
                                        edge="end"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{ mb: 1 }}
                />

                {/* Remember me + Forgot password */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    {realm.rememberMe && !usernameHidden && (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name="rememberMe"
                                    defaultChecked={!!login.rememberMe}
                                    size="small"
                                    sx={{ color: "#0F4C5C", "&.Mui-checked": { color: "#0F4C5C" } }}
                                />
                            }
                            label={<Typography variant="body2">{msg("rememberMe")}</Typography>}
                        />
                    )}
                    {realm.resetPasswordAllowed && (
                        <Link
                            href={url.loginResetCredentialsUrl}
                            underline="hover"
                            color="secondary.dark"
                            variant="body2"
                            sx={{ fontWeight: 500, ml: "auto" }}
                        >
                            {msg("doForgotPassword")}
                        </Link>
                    )}
                </Box>

                <input type="hidden" name="credentialId" value={auth.selectedCredential} />

                <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isSubmitting}
                    sx={{
                        py: 1.5,
                    }}
                >
                    {msgStr("doLogIn")}
                </Button>
            </form>
        </Template>
    );
}
