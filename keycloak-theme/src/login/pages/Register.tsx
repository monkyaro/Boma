import { useState } from "react";
import type { ComponentType } from "react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import type { BomaTemplateProps } from "../Template";
import {
    Box,
    Button,
    IconButton,
    InputAdornment,
    Link,
    TextField,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";


type RegisterKcContext = Extract<KcContext, { pageId: "register.ftl" }>;

export default function Register(
    props: PageProps<RegisterKcContext, I18n> & {
        UserProfileFormFields: ComponentType<any>;
        doMakeUserConfirmPassword: boolean;
    }
) {
    const { kcContext, i18n, doUseDefaultCss, Template: BaseTemplate, classes } = props;
    const Template = BaseTemplate as ComponentType<BomaTemplateProps>;

    const { url, realm, messagesPerField } = kcContext;
    // profile exists on register.ftl context but is not typed in the base extension
    const profile = (kcContext as any).profile;

    const { msg, msgStr } = i18n;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const fieldValue = (name: string): string =>
        profile?.attributesByName?.[name]?.value ?? "";

    const fieldError = (name: string) => messagesPerField.existsError(name);
    const fieldHelperText = (name: string) =>
        fieldError(name) ? messagesPerField.get(name) : undefined;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={true}
            headerNode={msg("registerTitle")}
        >
            <form
                onSubmit={() => setIsSubmitting(true)}
                action={url.registrationAction}
                method="post"
            >
                {/* First name + Last name */}
                <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                    <TextField
                        fullWidth
                        id="firstName"
                        name="firstName"
                        label={msgStr("firstName")}
                        defaultValue={fieldValue("firstName")}
                        autoFocus
                        autoComplete="given-name"
                        error={fieldError("firstName")}
                        helperText={fieldHelperText("firstName")}
                    />
                    <TextField
                        fullWidth
                        id="lastName"
                        name="lastName"
                        label={msgStr("lastName")}
                        defaultValue={fieldValue("lastName")}
                        autoComplete="family-name"
                        error={fieldError("lastName")}
                        helperText={fieldHelperText("lastName")}
                    />
                </Box>

                {/* Email */}
                <TextField
                    fullWidth
                    id="email"
                    name="email"
                    type="email"
                    label={msgStr("email")}
                    defaultValue={fieldValue("email")}
                    autoComplete="email"
                    error={fieldError("email")}
                    helperText={fieldHelperText("email")}
                    sx={{ mb: 2 }}
                />

                {/* Username — shown when email is not used as username */}
                {!realm.registrationEmailAsUsername && (
                    <TextField
                        fullWidth
                        id="username"
                        name="username"
                        label={msgStr("username")}
                        defaultValue={fieldValue("username")}
                        autoComplete="username"
                        error={fieldError("username")}
                        helperText={fieldHelperText("username")}
                        sx={{ mb: 2 }}
                    />
                )}

                {/* Password */}
                <TextField
                    fullWidth
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    label={msgStr("password")}
                    autoComplete="new-password"
                    error={fieldError("password")}
                    helperText={fieldHelperText("password")}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowPassword(v => !v)} edge="end">
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{ mb: 2 }}
                />

                {/* Confirm password */}
                <TextField
                    fullWidth
                    id="password-confirm"
                    name="password-confirm"
                    type={showConfirm ? "text" : "password"}
                    label={msgStr("passwordConfirm")}
                    autoComplete="new-password"
                    error={fieldError("password-confirm")}
                    helperText={fieldHelperText("password-confirm")}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowConfirm(v => !v)} edge="end">
                                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{ mb: 3 }}
                />

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
                    {msgStr("doRegister")}
                </Button>

                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
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
