using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPrefilledFieldsToInvite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PrefilledCpf",
                table: "Invites",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrefilledLastName",
                table: "Invites",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrefilledName",
                table: "Invites",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrefilledPhone",
                table: "Invites",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PrefilledCpf",
                table: "Invites");

            migrationBuilder.DropColumn(
                name: "PrefilledLastName",
                table: "Invites");

            migrationBuilder.DropColumn(
                name: "PrefilledName",
                table: "Invites");

            migrationBuilder.DropColumn(
                name: "PrefilledPhone",
                table: "Invites");
        }
    }
}
