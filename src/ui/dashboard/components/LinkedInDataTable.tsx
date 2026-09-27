// Removed h import as preact/compat usually handles it, or keep it if needed but TS warned about it.
// Actually, TS warns 'h' is declared but its value is never read if we use new JSX transform.
// I'll just remove the explicit import of 'h' if it's unused.
import { useState, useMemo } from "preact/hooks";
import { LinkedInProfileRecord } from "../../../core/schema/linkedin-profile";
import { renderIcon } from "../../shared-components/icon";

interface LinkedInDataTableProps {
  records: LinkedInProfileRecord[];
}

type SortField = "name" | "headline" | "location" | "connectionStatus" | "websiteStatus" | "extractionTimestamp";
type SortOrder = "asc" | "desc";

export function LinkedInDataTable({ records }: LinkedInDataTableProps) {
  const [sortField, setSortField] = useState<SortField>("extractionTimestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      let aVal = a[sortField] || "";
      let bVal = b[sortField] || "";

      if (sortField === "extractionTimestamp") {
        return sortOrder === "asc"
          ? new Date(aVal as string).getTime() - new Date(bVal as string).getTime()
          : new Date(bVal as string).getTime() - new Date(aVal as string).getTime();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [records, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span class="sort-icon inactive" dangerouslySetInnerHTML={{ __html: renderIcon("chevron-down", 14) }} />;
    return <span class="sort-icon active" dangerouslySetInnerHTML={{ __html: renderIcon("chevron-down", 14) }} style={{ transform: sortOrder === "asc" ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }} />;
  };

  const getWebsiteBadge = (status: string) => {
    switch (status) {
      case "website":
        return <span class="badge badge-success">Website</span>;
      case "social_only":
        return <span class="badge badge-warning">Social Only</span>;
      case "none":
        return <span class="badge badge-error">None</span>;
      default:
        return <span class="badge badge-neutral">{status}</span>;
    }
  };

  const getConnectionBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <span class="badge badge-success">Sent</span>;
      case "skipped_has_website":
        return <span class="badge badge-neutral">Skipped</span>;
      case "already_connected":
        return <span class="badge badge-info">1st Degree</span>;
      case "pending":
        return <span class="badge badge-warning">Pending</span>;
      case "failed":
        return <span class="badge badge-error">Failed</span>;
      case "queued":
        return <span class="badge badge-neutral">Queued</span>;
      default:
        return <span class="badge badge-neutral">{status}</span>;
    }
  };

  if (records.length === 0) {
    return (
      <div class="empty-state">
        <p>No LinkedIn profiles found for this session.</p>
      </div>
    );
  }

  return (
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th onClick={() => handleSort("name")} class="sortable">
              <div class="th-content">Name <SortIcon field="name" /></div>
            </th>
            <th onClick={() => handleSort("headline")} class="sortable">
              <div class="th-content">Headline <SortIcon field="headline" /></div>
            </th>
            <th onClick={() => handleSort("location")} class="sortable">
              <div class="th-content">Location <SortIcon field="location" /></div>
            </th>
            <th onClick={() => handleSort("websiteStatus")} class="sortable">
              <div class="th-content">Website Status <SortIcon field="websiteStatus" /></div>
            </th>
            <th onClick={() => handleSort("connectionStatus")} class="sortable">
              <div class="th-content">Connection Status <SortIcon field="connectionStatus" /></div>
            </th>
            <th>Profile URL</th>
          </tr>
        </thead>
        <tbody>
          {sortedRecords.map((record) => (
            <tr key={record.profileId}>
              <td>
                <div class="font-medium">{record.name}</div>
                {record.error && <div class="text-error text-caption mt-1">{record.error}</div>}
              </td>
              <td><div class="text-caption truncate" style={{ maxWidth: '250px' }} title={record.headline}>{record.headline}</div></td>
              <td><div class="text-caption">{record.location}</div></td>
              <td>{getWebsiteBadge(record.websiteStatus)}</td>
              <td>{getConnectionBadge(record.connectionStatus)}</td>
              <td>
                <a href={record.profileUrl} target="_blank" rel="noopener noreferrer" class="action-btn" title="Open Profile">
                  <span dangerouslySetInnerHTML={{ __html: renderIcon("external-link", 16) }} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
