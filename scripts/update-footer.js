const fs = require('fs');
let content = fs.readFileSync('src/components/unit-tabs/TaskCard.tsx', 'utf8');

// 1) Replace footer block
content = content.replace(
  '// Create footer content - badges, dates, comments, assignee\n  const footerContent = (\n    <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 mt-2">',
  '// Create footer content - badges, dates, comments, assignee\n  const footerContent = (\n    <div className="flex flex-col gap-3 mt-3">\n      <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">'
);

// 2) Append bottom button below dropdown logic
content = content.replace(
  '        </GlobalAssigneeSelector>\n        {/* Removing the old manual dropdown implementation */}\n      </div>\n    </div>\n  );',
  `        </GlobalAssigneeSelector>
        {/* Removing the old manual dropdown implementation */}
      </div>
      </div>

      {/* Action Button: Mark as Complete */}
      {onComplete && !isCompletedOptimistic && (
        <Button
          variant="outline"
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border-gray-200 hover:border-green-500 hover:bg-green-50 hover:text-green-700 dark:border-white/10 dark:hover:border-green-500/50 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-all font-medium text-[13px] shadow-sm hover:shadow"
          onClick={handleToggleComplete}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CheckCircle className="h-4 w-4" />
          <span>Mark as complete</span>
        </Button>
      )}
      
      {/* Action Button: Completed State */}
      {isCompletedOptimistic && (
        <div className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium text-[13px] border border-green-200 dark:border-green-800/50 shadow-sm">
          <CheckCircle className="h-4 w-4" />
          <span>Completed!</span>
        </div>
      )}
    </div>
  );`
);

fs.writeFileSync('src/components/unit-tabs/TaskCard.tsx', content);
