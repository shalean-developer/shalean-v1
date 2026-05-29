import type React from "react";
import {
  ADMIN_PAGE_DESCRIPTION_CLASS,
  ADMIN_PAGE_TITLE_CLASS,
} from "@/components/admin/admin-page-styles";

/** Matches the header layout on `/admin/dashboard` (overview). */
export function AdminPageOverviewHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="py-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={ADMIN_PAGE_TITLE_CLASS}>{title}</h1>
          <p className={ADMIN_PAGE_DESCRIPTION_CLASS}>{description}</p>
        </div>
        {action}
      </div>
    </section>
  );
}
