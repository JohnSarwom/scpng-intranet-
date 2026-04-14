const fs = require('fs');
let content = fs.readFileSync('src/components/unit-tabs/TaskCard.tsx', 'utf8');

if (!content.includes('fireCompletionConfetti')) {
  // Add import just before the interface props
  content = content.replace(
    '// Extend props to include anything needed by useSortable or event handlers',
    "import { fireCompletionConfetti } from '@/lib/confetti';\n\n// Extend props to include anything needed by useSortable or event handlers"
  );
}

// Modify handleToggleComplete
content = content.replace(
  /const handleToggleComplete = \(e: React\.MouseEvent\) => \{\s+e\.stopPropagation\(\);\s+\/\/ Optimistic update\s+const newValue = !isCompletedOptimistic;\s+setIsCompletedOptimistic\(newValue\);\s+if \(onComplete\) \{\s+onComplete\(id, newValue\);\s+\}\s+\};/,
  `const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic update
    const newValue = !isCompletedOptimistic;
    setIsCompletedOptimistic(newValue);

    if (newValue) {
      fireCompletionConfetti();
      setTimeout(() => {
        if (onComplete) onComplete(id, newValue);
      }, 1500); // 1.5s delay to let the confetti play
    } else {
      if (onComplete) onComplete(id, newValue);
    }
  };`
);

fs.writeFileSync('src/components/unit-tabs/TaskCard.tsx', content);
