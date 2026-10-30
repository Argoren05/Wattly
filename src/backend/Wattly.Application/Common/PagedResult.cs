namespace Wattly.Application.Common;

/// <summary>One page of a list.</summary>
/// <typeparam name="T">Item type.</typeparam>
/// <param name="Items">Items of the page.</param>
/// <param name="Page">Page number (1-based).</param>
/// <param name="PageSize">Page size.</param>
/// <param name="TotalCount">Total number of items.</param>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

/// <summary>Paging defaults and limits (DEC-014).</summary>
public static class Paging
{
    /// <summary>Page size used when none is given.</summary>
    public const int DefaultPageSize = 50;
    /// <summary>Largest allowed page size.</summary>
    public const int MaxPageSize = 200;

    /// <summary>Applies defaults and limits to paging parameters.</summary>
    /// <param name="page">Requested page.</param>
    /// <param name="pageSize">Requested size.</param>
    public static (int Page, int PageSize) Normalize(int? page, int? pageSize) =>
        (Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize));
}
