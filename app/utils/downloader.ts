import JSZip from 'jszip';

export async function downloadAsZip(
  results: any[], 
  format: 'png' | 'webp' | 'jpeg' = 'png', 
  quality: number = 0.9
) {
  const zip = new JSZip();
  let count = 0;

  // Helper for conversion
  const convertBlob = (blob: Blob): Promise<Blob> => {
      // PNG (default) doesn't need re-encoding if we want max quality, 
      // but if user wants to lower quality or change format, we must redraw.
      // Note: canvas.toBlob for PNG usually ignores quality param in some browsers, but we'll pass it.
      if (format === 'png' && quality > 0.95) return Promise.resolve(blob);

      return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              
              if (!ctx) { resolve(blob); return; }

              // JPEG needs white background (no transparency support)
              if (format === 'jpeg') {
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
              }
              
              ctx.drawImage(img, 0, 0);
              const mime = `image/${format}`;
              
              canvas.toBlob((b) => {
                  resolve(b || blob);
              }, mime, quality);
          };
          img.src = URL.createObjectURL(blob);
      });
  };

  // Add files to zip
  for (const res of results) {
    if (res.status === 'completed' && res.processedUrl) {
        try {
            const response = await fetch(res.processedUrl);
            const originalBlob = await response.blob();
            
            // Convert if needed
            const finalBlob = await convertBlob(originalBlob);

            // Fix extension in name
            let finalName = res.outputName || res.fileName;
            // Remove old extension
            finalName = finalName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
            // Add new extension
            finalName += `.${format}`;

            zip.file(finalName, finalBlob);
            count++;
        } catch (e) {
            console.error("Error adding file to zip", e);
        }
    }
  }

  if (count === 0) {
      alert("No valid files to export.");
      return;
  }

  // Generate zip
  const content = await zip.generateAsync({ type: "blob" });
  
  // NATIVE DOWNLOAD METHOD
  const url = window.URL.createObjectURL(content);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `SmartAsset_Export_${format.toUpperCase()}.zip`;
  
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}
