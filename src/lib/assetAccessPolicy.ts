export interface AssetAccessRecord {
  id?: string;
  sharepoint_item_id?: string;
  unit?: string;
  division?: string;
  assigned_to?: string;
  assigned_to_email?: string;
  created_by?: string;
}

export interface AssetAccessViewer {
  email?: string;
  name?: string;
  roleName?: string;
  jobTitle?: string;
  unitName?: string;
  divisionName?: string;
  isAdmin?: boolean;
}

const normalize = (value?: string) => value?.trim().toLowerCase() || '';

const isITLabel = (value?: string) => {
  const label = normalize(value);
  return label === 'it' ||
    label === 'it unit' ||
    label.includes('information technology') ||
    label.includes('information & technology');
};

const matchesIdentity = (value: string | undefined, viewer: AssetAccessViewer) => {
  const candidate = normalize(value);
  return Boolean(candidate) && (
    candidate === normalize(viewer.email) ||
    candidate === normalize(viewer.name)
  );
};

export const isITAsset = (asset?: AssetAccessRecord | null) =>
  Boolean(asset) && (isITLabel(asset.unit) || isITLabel(asset.division));

export const isITViewer = (viewer: AssetAccessViewer) =>
  isITLabel(viewer.unitName) || isITLabel(viewer.divisionName) ||
  isITLabel(viewer.jobTitle);

export const isAssetCreator = (
  asset: AssetAccessRecord | null | undefined,
  viewer: AssetAccessViewer,
) => Boolean(asset) && matchesIdentity(asset.created_by, viewer);

export const isAssetAssignee = (
  asset: AssetAccessRecord | null | undefined,
  viewer: AssetAccessViewer,
) => Boolean(asset) && (
  matchesIdentity(asset.assigned_to_email, viewer) ||
  matchesIdentity(asset.assigned_to, viewer)
);

const isDivisionLeader = (viewer: AssetAccessViewer) => {
  const role = normalize(viewer.roleName);
  const jobTitle = normalize(viewer.jobTitle);
  return role.includes('division_manager') ||
    role.includes('director') ||
    jobTitle.includes('director');
};

export const isAssetInViewerOrgScope = (
  asset: AssetAccessRecord | null | undefined,
  viewer: AssetAccessViewer,
) => {
  if (!asset) return false;

  if (isITAsset(asset)) {
    return isITViewer(viewer);
  }

  const assetUnit = normalize(asset.unit);
  const assetDivision = normalize(asset.division);
  const viewerUnit = normalize(viewer.unitName);
  const viewerDivision = normalize(viewer.divisionName);

  const sameUnit = Boolean(assetUnit && viewerUnit && assetUnit === viewerUnit);
  const sameDivision = Boolean(
    assetDivision && viewerDivision && assetDivision === viewerDivision
  );

  if (sameUnit) return true;
  if (sameDivision && isDivisionLeader(viewer)) return true;

  // Division-only records remain visible within the division. When both the
  // asset and viewer have a unit, unit isolation takes precedence.
  return sameDivision && (!assetUnit || !viewerUnit);
};

export const canViewAsset = (
  asset: AssetAccessRecord | null | undefined,
  viewer: AssetAccessViewer,
) => Boolean(asset) && (
  isAssetAssignee(asset, viewer) ||
  isAssetCreator(asset, viewer) ||
  isAssetInViewerOrgScope(asset, viewer)
);

export const isPrivilegedAssetOperator = (viewer: AssetAccessViewer) => {
  if (isITViewer(viewer) || viewer.isAdmin) return true;

  const role = normalize(viewer.roleName);
  const jobTitle = normalize(viewer.jobTitle);

  return role.includes('manager') ||
    role.includes('director') ||
    role.includes('admin') ||
    jobTitle.includes('manager') ||
    jobTitle.includes('director') ||
    jobTitle.includes('admin officer') ||
    jobTitle.includes('administration officer') ||
    jobTitle.includes('administrative officer');
};

export const canCreateAsset = (viewer: AssetAccessViewer) =>
  isPrivilegedAssetOperator(viewer);

export const canModifyAsset = (
  asset: AssetAccessRecord | null | undefined,
  viewer: AssetAccessViewer,
) => Boolean(asset) && (
  isAssetCreator(asset, viewer) ||
  (isPrivilegedAssetOperator(viewer) && isAssetInViewerOrgScope(asset, viewer))
);
