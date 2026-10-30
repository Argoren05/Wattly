namespace Wattly.Application.Invoices;

/// <summary>Detects allowed attachment types by their magic bytes.</summary>
public static class FileSignatures
{
    public const string Pdf = "application/pdf";
    public const string Jpeg = "image/jpeg";
    public const string Png = "image/png";

    public static string? Detect(ReadOnlySpan<byte> header)
    {
        if (header.StartsWith("%PDF-"u8))
            return Pdf;
        if (header.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF }))
            return Jpeg;
        if (header.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
            return Png;
        return null;
    }

    public static string Extension(string contentType) => contentType switch
    {
        Pdf => ".pdf",
        Jpeg => ".jpg",
        Png => ".png",
        _ => string.Empty,
    };
}
