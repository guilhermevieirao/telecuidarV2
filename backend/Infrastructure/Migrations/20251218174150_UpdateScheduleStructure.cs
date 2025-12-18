using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateScheduleStructure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SlotDurationMinutes",
                table: "Schedules");

            migrationBuilder.RenameColumn(
                name: "StartTime",
                table: "Schedules",
                newName: "ValidityStartDate");

            migrationBuilder.RenameColumn(
                name: "EndTime",
                table: "Schedules",
                newName: "GlobalConfigJson");

            migrationBuilder.RenameColumn(
                name: "DaysOfWeekJson",
                table: "Schedules",
                newName: "DaysConfigJson");

            migrationBuilder.AddColumn<DateTime>(
                name: "ValidityEndDate",
                table: "Schedules",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ValidityEndDate",
                table: "Schedules");

            migrationBuilder.RenameColumn(
                name: "ValidityStartDate",
                table: "Schedules",
                newName: "StartTime");

            migrationBuilder.RenameColumn(
                name: "GlobalConfigJson",
                table: "Schedules",
                newName: "EndTime");

            migrationBuilder.RenameColumn(
                name: "DaysConfigJson",
                table: "Schedules",
                newName: "DaysOfWeekJson");

            migrationBuilder.AddColumn<int>(
                name: "SlotDurationMinutes",
                table: "Schedules",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }
    }
}
