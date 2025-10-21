// Script to generate a large HTML file for testing 33+ chunks (64KB+ HTML)
const fs = require('fs');

console.log('Generating large HTML file for 33+ chunks test...');

// Base HTML structure (about 1KB)
const baseHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Race Condition Test - 33+ Chunks</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .content { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <h1>Race Condition Protection Test</h1>
    <p>This HTML file is designed to exceed 64KB for 33+ chunk testing of our enhanced transfer protocol.</p>
    <div class="content" id="large-content-start">
`;

// Large content blocks (each about 16KB to ensure safety)
const contentBlock = `
<div class="content">
    <h3>Technical Implementation Details</h3>
    <p>Our enhanced chunk transfer system includes comprehensive race condition protection with multi-layered storage:</p>
    <ul>
        <li><strong>Active Transfers:</strong> Primary storage layer with real-time state management</li>
        <li><strong>Completed Backup:</strong> Persistent storage for completed transfers to prevent premature cleanup</li>
        <li><strong>Global References:</strong> Cross-script accessible storage for immediate transfer access</li>
        <li><strong>Global Scope Backup:</strong> Ultimate fallback mechanism for critical operations</li>
        <li><strong>Enhanced Cleanup:</strong> Staggered retention periods preventing race condition-induced losses</li>
    </ul>

    <div class="details">
        <p>Transfer State Management implements a sophisticated lifecycle:</p>
        <p><em>Phase 1:</em> Active transfer in primary storage with full monitoring and validation</p>
        <p><em>Phase 2:</em> Transfer completion moves data to completed backup storage for persistence</p>
        <p><em>Phase 3:</em> HTML assembly triggered only when all chunk acknowledgments are received</p>
        <p><em>Phase 4:</em> Safe cleanup with extended retention periods for completed transfers</p>
        <p><em>Phase 5:</em> Global references maintained for immediate access during transition periods</p>
    </div>

    <div class="diagnostics">
        <p>Comprehensive diagnostic logging includes:</p>
        <p>• Transfer scope monitoring every 10 seconds</p>
        <p>• Detailed chunk acknowledgment tracking</p>
        <p>• Assembly process validation and verification</p>
        <p>• Cleanup timing analysis and race condition detection</p>
        <p>• Fallback mechanism activation logging</p>
    </div>

    <div class="fallback-mechanisms">
        <p>Graceful degradation strategies include:</p>
        <p>• Empty HTML fallback when all recovery mechanisms fail</p>
        <p>• Transfer state reconstruction from global scope</p>
        <p>• Partial HTML assembly for incomplete transfers</p>
        <p>• Diagnostic data preservation for debugging analysis</p>
        <p>• Extension reload prevention for stability</p>
    </div>

    <div class="performance-optimization">
        <p>Performance enhancements include:</p>
        <p>• Parallel chunk transmission for maximum throughput</p>
        <p>• Exponential backoff retry mechanism</p>
        <p>• Chunk size optimization (32KB per chunk)</p>
        <p>• Memory-efficient storage layer management</p>
        <p>• Staggered cleanup to reduce processing overhead</p>
    </div>
</div>
`;

// Footer and closing
const htmlFooter = `
    </div>
    <div class="footer">
        <p>Test completed. This HTML document was generated to test 33+ chunk transfers with race condition protection.</p>
        <script>console.log('Large HTML test document loaded. Size: ' + document.documentElement.outerHTML.length + ' characters');</script>
    </div>
</body>
</html>`;

// Calculate how many content blocks needed for 33+ chunks
// 32KB per chunk * 33 chunks = 1056KB (1MB+)
// Each content block is about 16KB (x2 = 32KB per full block)
const targetSizeBytes = 32 * 1024 * 33; // 1MB
const contentBlockSize = Buffer.byteLength(contentBlock, 'utf8');
const numBlocks = Math.ceil(targetSizeBytes * 1.2 / contentBlockSize); // Add 20% margin

console.log('Target size: ' + targetSizeBytes.toLocaleString() + ' bytes');
console.log('Content block size: ' + contentBlockSize + ' bytes');
console.log('Number of blocks needed: ' + numBlocks);

// Build the complete HTML
let fullContent = baseHtml;
for (let i = 0; i < numBlocks; i++) {
    fullContent += contentBlock.replace('33+ Chunks', '33+ Chunks - Block ' + (i + 1));
}
fullContent += htmlFooter;

// Write to file
fs.writeFileSync('./large-test-file.html', fullContent, 'utf8');

const generatedSize = Buffer.byteLength(fullContent, 'utf8');
const expectedChunks = Math.ceil(generatedSize / (32 * 1024));

console.log('✅ Generated file: ' + generatedSize.toLocaleString() + ' bytes');
console.log('📦 Expected chunks: ' + expectedChunks);
console.log('💾 File saved as: ./large-test-file.html');

if (expectedChunks >= 33) {
    console.log('🎉 SUCCESS: File large enough for 33+ chunk testing!');
} else {
    console.log('⚠️ WARNING: File may need to be larger for proper testing');
}

// Also create summary file
const summary = 'Large HTML Test File Summary:\n' +
'- Target size: ' + (targetSizeBytes / 1024 / 1024).toFixed(2) + ' MB\n' +
'- Generated size: ' + (generatedSize / 1024 / 1024).toFixed(2) + ' MB\n' +
'- Expected chunks: ' + expectedChunks + '\n' +
'- Creation time: ' + new Date().toISOString() + '\n\n' +
'This file contains detailed technical content about our race condition protection\n' +
'mechanisms and is designed to thoroughly test the enhanced chunk transfer system.\n';

fs.writeFileSync('./large-test-summary.txt', summary, 'utf8');
console.log('📋 Summary saved as: ./large-test-summary.txt');