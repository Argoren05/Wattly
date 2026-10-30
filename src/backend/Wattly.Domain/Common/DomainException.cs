namespace Wattly.Domain.Common;

/// <summary>
/// Violation of a domain rule. <see cref="Code"/> is a stable, machine-readable identifier for clients.
/// </summary>
public class DomainException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
