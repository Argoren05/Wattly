namespace Wattly.Domain.Common;

/// <summary>
/// Violation of a domain rule. <see cref="Code"/> is a stable, machine-readable identifier for clients.
/// </summary>
/// <param name="code">Stable error code, e.g. <c>reading.not_monotonic</c>.</param>
/// <param name="message">Human-readable (Polish) description shown to the user.</param>
public class DomainException(string code, string message) : Exception(message)
{
    /// <summary>Stable, machine-readable error code.</summary>
    public string Code { get; } = code;
}
