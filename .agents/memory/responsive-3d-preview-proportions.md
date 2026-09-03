# Responsive 3D preview proportions

The 3D editor's renderer and camera must use the same measured canvas-frame dimensions at every viewport. A uniform sphere should remain round; CSS canvas stretching, stale renderer dimensions, or a camera/render-target aspect mismatch can turn it into an ellipse. This is a rendering/layout defect, not a reason to rewrite persisted object transforms: intentional non-uniform scale must remain visible. Mobile verification must also check page-level horizontal overflow and clipped inspector/stage controls. See #349 and #348.
