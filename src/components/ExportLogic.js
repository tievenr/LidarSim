/**
 * Export point cloud data in PCD format
 */
export function exportPointCloudPCD(pointCloudData) {
  // Generate PCD header
  const pointCount = pointCloudData.length;
  let pcdHeader = `VERSION .7
FIELDS x y z intensity time tag line
SIZE 4 4 4 4 4 1 1
TYPE F F F F F U U
COUNT 1 1 1 1 1 1 1
WIDTH ${pointCount}
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${pointCount}
DATA ascii
`;

  // Generate PCD data
  let pcdData = pointCloudData
    .map(
      (point) =>
        `${point.x.toFixed(6)} ${point.y.toFixed(6)} ${point.z.toFixed(
          6
        )} ${point.intensity.toFixed(6)} ${(point.time / 1000).toFixed(6)} ${
          point.tag
        } ${point.line}`
    )
    .join("\n");

  // Combine header and data
  const pcdContent = pcdHeader + pcdData;

  // Create downloadable file
  downloadFile(pcdContent, "lidar_point_cloud.pcd", "text/plain");
}

/**
 * Export point cloud data in JSON format
 */
export function exportPointCloudJSON(pointCloudData) {
  const data = pointCloudData;
  downloadFile(
    JSON.stringify(data),
    "lidar_point_cloud.json",
    "application/json"
  );
}

/**
 * Helper function to download file
 */
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url); // Clean up
}

/**
 * Register export functions to window object for UI button access
 */
export function registerExportFunctions(getPointCloudData) {
  // Original export function for backward compatibility
  window.exportLidarPointCloud = () => exportPointCloudPCD(getPointCloudData());

  // New export functions
  window.exportLidarPointCloudPCD = () =>
    exportPointCloudPCD(getPointCloudData());
  window.exportLidarPointCloudJSON = () =>
    exportPointCloudJSON(getPointCloudData());

  // Return cleanup function
  return () => {
    delete window.exportLidarPointCloud;
    delete window.exportLidarPointCloudPCD;
    delete window.exportLidarPointCloudJSON;
  };
}
