using Microsoft.AspNetCore.Identity;
using Wattly.Infrastructure.Identity;

namespace Wattly.Api.Infrastructure;

/// <summary>
/// Development-only sender that writes account e-mails to the log. Production requires a real e-mail provider
/// (see doc/Wattly_Decisions.md, DEC-016); without it, password reset codes are not delivered.
/// </summary>
public sealed class DevelopmentEmailSender(ILogger<DevelopmentEmailSender> logger) : IEmailSender<AppUser>
{
    public Task SendConfirmationLinkAsync(AppUser user, string email, string confirmationLink)
    {
        logger.LogInformation("[DEV e-mail] Confirmation link for {Email}: {Link}", email, confirmationLink);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetLinkAsync(AppUser user, string email, string resetLink)
    {
        logger.LogInformation("[DEV e-mail] Password reset link for {Email}: {Link}", email, resetLink);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetCodeAsync(AppUser user, string email, string resetCode)
    {
        logger.LogInformation("[DEV e-mail] Password reset code for {Email}: {Code}", email, resetCode);
        return Task.CompletedTask;
    }
}
