import prisma from '@/lib/prisma';

/**
 * Helper to decode authToken and get user info from custom auth
 */
function getUserFromToken(request) {
  try {
    // Get authToken from cookies
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...v] = c.split('=');
        return [key, v.join('=')];
      })
    );

    const authToken = cookies.authToken;
    if (!authToken) return null;

    // Decode the base64 token: "userId:email:timestamp"
    const decoded = Buffer.from(authToken, 'base64').toString('utf-8');
    const [userId, email] = decoded.split(':');

    return {
      id: parseInt(userId),
      email: email,
      name: email.split('@')[0] // Use email prefix as fallback name
    };
  } catch (error) {
    console.error('Error decoding authToken:', error);
    return null;
  }
}

/**
 * Central audit logging utility
 * Logs all data changes with user info, timestamps, and source
 */
export async function logAuditTrail({
  projectId,
  moduleName,
  subModule = null,
  changes = [],
  actionType = 'UPDATE', // UPDATE, CREATE, DELETE
  request = null
}) {
  try {
    console.log('🔍 [AUDIT] Starting audit log for:', { projectId, moduleName, subModule, actionType, changesCount: changes.length });
    
    // Get user info from authToken
    const user = getUserFromToken(request);

    if (!user) {
      console.warn('⚠️ No user found in authToken for audit logging');
      return;
    }

    console.log('👤 [AUDIT] User decoded from token:', user);

    // Fetch user name from database if available
    let userName = user.name;
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true }
      });
      userName = dbUser?.name || dbUser?.email || user.email;
      console.log('👤 [AUDIT] User from database:', userName);
    } catch (err) {
      console.warn('Could not fetch user from database, using token data:', err.message);
    }

    // Fetch project name from database
    let projectName = `Project ${projectId}`;
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { project_name: true }
      });
      projectName = project?.project_name || projectName;
      console.log('📁 [AUDIT] Project name:', projectName);
    } catch (err) {
      console.warn('Could not fetch project name, using fallback:', err.message);
    }

    // Filter out null/empty changes and only log actual changes
    const validChanges = changes.filter(change => {
      // Convert to string for comparison to handle null/undefined
      const oldStr = change.oldValue?.toString() || '';
      const newStr = change.newValue?.toString() || '';
      return oldStr !== newStr;
    });

    console.log('📝 [AUDIT] Valid changes after filtering:', validChanges.length);
    
    if (validChanges.length === 0) {
      console.log('ℹ️ No actual changes detected, skipping audit log');
      return;
    }

    console.log('📊 [AUDIT] Changes to log:', validChanges);

    // Prepare audit log entries (matching your AuditLog schema)
    const auditEntries = validChanges.map(change => ({
      project_name: projectName,
      user_name: userName,
      module_name: moduleName,
      sub_module: subModule,
      field_name: change.fieldName,
      old_value: change.oldValue?.toString() || null,
      new_value: change.newValue?.toString() || null,
      action_type: actionType, // UPDATE, CREATE, or DELETE
      timestamp: new Date(),
    }));
    console.log('💾 [AUDIT] Audit entries:', auditEntries);

    // Batch insert audit logs
    console.log('💾 [AUDIT] Attempting to save to database...');
    await prisma.auditLog.createMany({
      data: auditEntries
    });

    console.log(`✅ Logged ${auditEntries.length} audit entries for ${moduleName}${subModule ? ` > ${subModule}` : ''}`);

  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('❌ Audit logging error:', error);
    console.error('❌ Error details:', error.message);
    
    // Check if it's a table not found error
    if (error.message && error.message.includes('does not exist')) {
      console.error('⚠️ IMPORTANT: The audit_logs table does not exist!');
      console.error('⚠️ Please run: npx prisma migrate dev --name add_audit_log_table');
    }
  }
}

/**
 * Helper to format field names nicely
 */
export function formatFieldName(key, context = {}) {
  // Handle composite keys like "Payment Frequency_Term Loan"
  if (context.parameterName && context.loanType) {
    return `${context.parameterName} - ${context.loanType}`;
  }
  
  // Handle DSCR "value" field - use parameter name instead
  if (key === 'value' && context.parameterName) {
    return context.parameterName;
  }
  
  // Handle parameter name from context for other fields
  if (key !== 'value' && key !== 'as_of_date' && context.parameterName) {
    return `${context.parameterName} - ${formatKey(key)}`;
  }
  
  // Convert snake_case to Title Case
  return formatKey(key);
}

function formatKey(key) {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper to format submodule names
 */
export function formatSubmoduleName(submoduleName) {
  return submoduleName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
