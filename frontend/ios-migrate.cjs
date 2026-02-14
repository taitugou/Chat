const fs = require('fs');
const path = require('path');

// 获取所有 Vue 文件
function getVueFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !item.includes('node_modules')) {
      getVueFiles(fullPath, files);
    } else if (item.endsWith('.vue')) {
      files.push(fullPath);
    }
  }
  return files;
}

// 替换规则 - 按特定顺序排列（长的先替换）
const replacements = [
  // glass 组件类
  { from: /glass-btn-primary/g, to: 'ios-btn-primary' },
  { from: /glass-card-hover/g, to: 'ios-card-hover' },
  { from: /glass-card-content/g, to: 'ios-card-content' },
  { from: /glass-text-outline/g, to: 'text-ios-label-primary' },
  { from: /glass-select/g, to: 'ios-select' },
  { from: /glass-modal/g, to: 'ios-modal' },
  { from: /glass-input/g, to: 'ios-input' },
  { from: /glass-badge/g, to: 'ios-badge' },
  { from: /glass-card/g, to: 'ios-card' },
  { from: /glass-btn/g, to: 'ios-btn-secondary' },
  { from: /glass-nav/g, to: 'ios-nav' },
  { from: /glass-text/g, to: 'text-ios-label-primary' },
  { from: /glass-sm/g, to: 'ios-glass-sm' },
  { from: /glass-lg/g, to: 'ios-glass-lg' },
  { from: /glass-hover/g, to: 'ios-hover' },
  { from: /\bglass\b/g, to: 'ios-glass' },

  // Primary 颜色类
  { from: /bg-primary\/30/g, to: 'bg-ios-blue/30' },
  { from: /bg-primary\/20/g, to: 'bg-ios-blue/20' },
  { from: /bg-primary\/10/g, to: 'bg-ios-blue/10' },
  { from: /border-primary\/50/g, to: 'border-ios-blue/50' },
  { from: /border-primary\/30/g, to: 'border-ios-blue/30' },
  { from: /border-primary\/20/g, to: 'border-ios-blue/20' },
  { from: /text-primary/g, to: 'text-ios-blue' },
  { from: /bg-primary/g, to: 'bg-ios-blue' },
  { from: /border-primary/g, to: 'border-ios-blue' },
  { from: /from-primary/g, to: 'from-ios-blue' },
  { from: /to-primary/g, to: 'to-ios-blue' },
  { from: /shadow-primary\/20/g, to: 'shadow-ios' },
  { from: /shadow-primary/g, to: 'shadow-ios' },
  { from: /ring-primary\/50/g, to: 'ring-ios-blue/50' },
  { from: /ring-primary\/30/g, to: 'ring-ios-blue/30' },
  { from: /accent-primary/g, to: 'accent-ios-blue' },

  // Foreground 文本类
  { from: /text-foreground\/90/g, to: 'text-ios-label-primary' },
  { from: /text-foreground\/80/g, to: 'text-ios-label-primary' },
  { from: /text-foreground\/70/g, to: 'text-ios-label-secondary' },
  { from: /text-foreground\/60/g, to: 'text-ios-label-secondary' },
  { from: /text-foreground\/50/g, to: 'text-ios-label-tertiary' },
  { from: /text-foreground\/40/g, to: 'text-ios-label-tertiary' },
  { from: /text-foreground\/30/g, to: 'text-ios-label-tertiary' },
  { from: /text-foreground\/20/g, to: 'text-ios-label-quaternary' },
  { from: /text-foreground\/10/g, to: 'text-ios-label-quaternary' },
  { from: /text-foreground\/5/g, to: 'text-ios-label-quaternary' },
  { from: /text-foreground/g, to: 'text-ios-label-primary' },

  // Background 类
  { from: /bg-background\/80/g, to: 'bg-ios-systemGray6/80' },
  { from: /bg-background/g, to: 'bg-ios-systemGray6' },

  // Foreground 背景类
  { from: /bg-foreground\/20/g, to: 'bg-ios-systemGray5' },
  { from: /bg-foreground\/10/g, to: 'bg-ios-systemGray5' },
  { from: /bg-foreground\/5/g, to: 'bg-ios-systemGray5' },

  // Foreground 边框类
  { from: /border-foreground\/30/g, to: 'border-ios-separator' },
  { from: /border-foreground\/20/g, to: 'border-ios-separator' },
  { from: /border-foreground\/10/g, to: 'border-ios-separator' },
  { from: /border-foreground\/5/g, to: 'border-ios-separator' },

  // Hover 状态
  { from: /hover:bg-foreground\/10/g, to: 'hover:bg-ios-systemGray5' },
  { from: /hover:bg-foreground\/5/g, to: 'hover:bg-ios-systemGray5' },
  { from: /hover:text-foreground\/80/g, to: 'hover:text-ios-label-secondary' },
  { from: /hover:text-foreground\/70/g, to: 'hover:text-ios-label-secondary' },
  { from: /hover:text-foreground\/60/g, to: 'hover:text-ios-label-secondary' },
  { from: /hover:border-primary\/50/g, to: 'hover:border-ios-blue/50' },
  { from: /hover:border-primary\/30/g, to: 'hover:border-ios-blue/30' },
  { from: /hover:text-primary/g, to: 'hover:text-ios-blue' },
  { from: /hover:bg-primary/g, to: 'hover:bg-ios-blue' },

  // White 文本类
  { from: /text-white\/95/g, to: 'text-ios-label-primary' },
  { from: /text-white\/90/g, to: 'text-ios-label-primary' },
  { from: /text-white\/80/g, to: 'text-ios-label-primary' },
  { from: /text-white\/70/g, to: 'text-ios-label-secondary' },
  { from: /text-white\/65/g, to: 'text-ios-label-secondary' },
  { from: /text-white\/60/g, to: 'text-ios-label-secondary' },
  { from: /text-white\/50/g, to: 'text-ios-label-tertiary' },
  { from: /text-white\/45/g, to: 'text-ios-label-tertiary' },
  { from: /text-white\/40/g, to: 'text-ios-label-tertiary' },
  { from: /text-white\/30/g, to: 'text-ios-label-quaternary' },
  { from: /text-white\/20/g, to: 'text-ios-label-quaternary' },
  { from: /text-white\/10/g, to: 'text-ios-label-quaternary' },
  { from: /text-white\/5/g, to: 'text-ios-label-quaternary' },

  // White 背景类
  { from: /bg-white\/30/g, to: 'bg-ios-systemGray5' },
  { from: /bg-white\/20/g, to: 'bg-ios-systemGray5' },
  { from: /bg-white\/15/g, to: 'bg-ios-systemGray5' },
  { from: /bg-white\/10/g, to: 'bg-ios-systemGray5' },
  { from: /bg-white\/8/g, to: 'bg-ios-systemGray5' },
  { from: /bg-white\/6/g, to: 'bg-ios-systemGray5' },
  { from: /bg-white\/5/g, to: 'bg-ios-systemGray5' },
  { from: /bg-white\/\[0\.03\]/g, to: 'bg-ios-systemGray5' },

  // White 边框类
  { from: /border-white\/30/g, to: 'border-ios-separator' },
  { from: /border-white\/20/g, to: 'border-ios-separator' },
  { from: /border-white\/15/g, to: 'border-ios-separator' },
  { from: /border-white\/10/g, to: 'border-ios-separator' },
  { from: /border-white\/8/g, to: 'border-ios-separator' },
  { from: /border-white\/5/g, to: 'border-ios-separator' },

  // Divide 类
  { from: /divide-white\/10/g, to: 'divide-ios-separator' },
  { from: /divide-white\/5/g, to: 'divide-ios-separator' },

  // Black 背景
  { from: /bg-black\/80/g, to: 'bg-ios-black/80' },
  { from: /bg-black\/60/g, to: 'bg-ios-black/60' },
  { from: /bg-black\/40/g, to: 'bg-ios-black/40' },
  { from: /\bbg-black\b(?!\/)/g, to: 'bg-ios-black' },

  // Purple
  { from: /to-purple-600/g, to: 'to-ios-purple' },
  { from: /text-purple-600/g, to: 'text-ios-purple' },

  // Group hover
  { from: /group-hover:text-primary/g, to: 'group-hover:text-ios-blue' },
  { from: /group-hover:bg-primary/g, to: 'group-hover:bg-ios-blue' },
  { from: /group-hover:border-primary/g, to: 'group-hover:border-ios-blue' },
  { from: /group-hover:text-white/g, to: 'group-hover:text-ios-label-primary' },

  // Peer checked
  { from: /peer-checked:bg-primary/g, to: 'peer-checked:bg-ios-blue' },
  { from: /peer-checked:border-primary/g, to: 'peer-checked:border-ios-blue' },

  // Focus
  { from: /focus:ring-primary/g, to: 'focus:ring-ios-blue' },
  { from: /focus:border-primary/g, to: 'focus:border-ios-blue' },

  // Placeholder
  { from: /placeholder-white\/50/g, to: 'placeholder-ios-label-tertiary' },
  { from: /placeholder-white\/40/g, to: 'placeholder-ios-label-tertiary' },
];

// 处理单个文件
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const { from, to } of replacements) {
    if (from.test(content)) {
      content = content.replace(from, to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ ${filePath}`);
    return true;
  }
  return false;
}

// 主函数
function main() {
  const srcDir = path.join(__dirname, 'src');
  const vueFiles = getVueFiles(srcDir);

  console.log(`Found ${vueFiles.length} Vue files\n`);

  let modifiedCount = 0;
  for (const file of vueFiles) {
    if (processFile(file)) {
      modifiedCount++;
    }
  }

  console.log(`\n✅ Modified ${modifiedCount} files`);
}

main();
