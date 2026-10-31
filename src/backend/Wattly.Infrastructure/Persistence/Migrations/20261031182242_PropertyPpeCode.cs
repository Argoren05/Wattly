using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wattly.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PropertyPpeCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PpeCode",
                table: "Properties",
                type: "character varying(18)",
                maxLength: 18,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PpeCode",
                table: "Properties");
        }
    }
}
