import { useState, useEffect } from 'react';
import { Shield, Download, Filter, RefreshCw, Calendar, User, Target } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { fetchAdminActions } from '../lib/api';

export default function AdminOverrides() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadActions();
  }, []);

  const loadActions = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminActions(100); // Fetch last 100 actions
      setActions(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching admin actions:', error);
      setLoading(false);
    }
  };

  const filteredActions = filter === 'all' 
    ? actions 
    : actions.filter(a => a.action_type === filter);

  const actionTypes = [...new Set(actions.map(a => a.action_type))];

  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'Admin', 'Action Type', 'Target Type', 'Reason'];
    const rows = filteredActions.map(action => [
      new Date(action.created_at).toLocaleDateString(),
      new Date(action.created_at).toLocaleTimeString(),
      action.admin_name,
      action.action_type,
      action.target_type || '-',
      action.reason || '-',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading audit log...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-[#ef4444]" />
            Admin Overrides & Audit Log
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Complete audit trail of all administrative actions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadActions} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Actions</p>
            <p className="text-3xl font-bold text-foreground mt-1">{actions.length}</p>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Action Types</p>
            <p className="text-3xl font-bold text-foreground mt-1">{actionTypes.length}</p>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Today</p>
            <p className="text-3xl font-bold text-foreground mt-1">
              {actions.filter(a => {
                const actionDate = new Date(a.created_at).toDateString();
                const today = new Date().toDateString();
                return actionDate === today;
              }).length}
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Last 24h</p>
            <p className="text-3xl font-bold text-foreground mt-1">
              {actions.filter(a => {
                const actionTime = new Date(a.created_at).getTime();
                const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
                return actionTime > dayAgo;
              }).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Filter Section */}
      <Card className="bg-card border border-border p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filter by Action Type:</span>
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All ({actions.length})
          </Button>
          {actionTypes.map(type => (
            <Button
              key={type}
              size="sm"
              variant={filter === type ? 'default' : 'outline'}
              onClick={() => setFilter(type)}
            >
              {type.replace(/_/g, ' ')} ({actions.filter(a => a.action_type === type).length})
            </Button>
          ))}
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="bg-card border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-b border-border hover:bg-muted/30">
                <TableHead className="text-xs font-bold text-foreground">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date & Time
                </TableHead>
                <TableHead className="text-xs font-bold text-foreground">
                  <User className="w-4 h-4 inline mr-1" />
                  Admin
                </TableHead>
                <TableHead className="text-xs font-bold text-foreground">Action Type</TableHead>
                <TableHead className="text-xs font-bold text-foreground">
                  <Target className="w-4 h-4 inline mr-1" />
                  Target
                </TableHead>
                <TableHead className="text-xs font-bold text-foreground">Reason</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No admin actions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredActions.map((action) => (
                  <TableRow key={action.id} className="border-b border-border hover:bg-muted/20">
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(action.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {action.admin_name}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary font-medium">
                        {action.action_type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {action.target_type ? (
                        <span className="text-xs px-2 py-1 rounded bg-muted text-foreground">
                          {action.target_type}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {action.reason || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {action.metadata ? (
                        <span className="text-xs text-muted-foreground">
                          {typeof action.metadata === 'object' 
                            ? Object.keys(action.metadata).join(', ')
                            : 'View details'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Warning Notice */}
      <Card className="bg-[#ef4444]/10 border border-[#ef4444]/30 p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#ef4444] mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Admin Actions Are Permanently Logged</p>
            <p className="text-xs text-muted-foreground mt-1">
              All administrative actions performed in this portal are permanently recorded in the audit log.
              This ensures accountability and traceability of all system modifications.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
