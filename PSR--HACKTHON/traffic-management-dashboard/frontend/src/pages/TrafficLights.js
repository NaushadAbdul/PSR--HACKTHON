import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  IconButton,
  Tooltip,
  Button,
  Divider,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Slider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Traffic as TrafficIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  DirectionsCar as CarIcon,
  PedalBike as BikeIcon,
  DirectionsWalk as WalkIcon,
  Timer as TimerIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { formatDistanceToNow } from 'date-fns';

// Mock data for traffic lights
const mockIntersections = [
  {
    id: 'int-001',
    name: 'MG Road & Brigade Road',
    status: 'active',
    lastUpdated: new Date('2023-06-15T10:30:00'),
    phases: [
      { id: 'north-south', name: 'North-South', duration: 45, active: true, color: 'green' },
      { id: 'east-west', name: 'East-West', duration: 40, active: false, color: 'red' },
      { id: 'pedestrian', name: 'Pedestrian', duration: 20, active: false, color: 'red' },
    ],
    vehicleCount: 124,
    avgWaitTime: 45,
  },
  {
    id: 'int-002',
    name: 'Indiranagar 100ft Road',
    status: 'active',
    lastUpdated: new Date('2023-06-15T10:32:15'),
    phases: [
      { id: 'north-south', name: 'North-South', duration: 60, active: true, color: 'green' },
      { id: 'east-west', name: 'East-West', duration: 50, active: false, color: 'red' },
    ],
    vehicleCount: 89,
    avgWaitTime: 30,
  },
  {
    id: 'int-003',
    name: 'Outer Ring Road & Marathahalli',
    status: 'maintenance',
    lastUpdated: new Date('2023-06-15T09:15:00'),
    phases: [
      { id: 'north-south', name: 'North-South', duration: 30, active: false, color: 'yellow' },
      { id: 'east-west', name: 'East-West', duration: 30, active: false, color: 'yellow' },
    ],
    vehicleCount: 0,
    avgWaitTime: 0,
  },
  {
    id: 'int-004',
    name: 'Koramangala 80ft Road',
    status: 'inactive',
    lastUpdated: new Date('2023-06-14T22:10:00'),
    phases: [
      { id: 'north-south', name: 'North-South', duration: 40, active: false, color: 'red' },
      { id: 'east-west', name: 'East-West', duration: 40, active: true, color: 'green' },
    ],
    vehicleCount: 0,
    avgWaitTime: 0,
  },
];

const StatusChip = styled(Chip)(({ theme, status }) => ({
  textTransform: 'capitalize',
  backgroundColor: 
    status === 'active' ? theme.palette.success.light :
    status === 'maintenance' ? theme.palette.warning.light :
    theme.palette.grey[300],
  color: 
    status === 'active' ? theme.palette.success.dark :
    status === 'maintenance' ? theme.palette.warning.dark :
    theme.palette.text.secondary,
  fontWeight: 500,
}));

const TrafficLight = ({ color, size = 'medium', active = false }) => {
  const sizeMap = {
    small: { width: 12, height: 12, margin: 1 },
    medium: { width: 20, height: 20, margin: 1.5 },
    large: { width: 30, height: 30, margin: 2 },
  };
  
  const { width, height, margin } = sizeMap[size];
  
  return (
    <Box
      sx={{
        width,
        height,
        borderRadius: '50%',
        backgroundColor: active ? color : '#e0e0e0',
        opacity: active ? 1 : 0.3,
        margin: `${margin}px`,
        boxShadow: active ? `0 0 10px ${color}80` : 'none',
        transition: 'all 0.3s ease',
      }}
    />
  );
};

const TrafficLights = () => {
  const [intersections, setIntersections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIntersection, setSelectedIntersection] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      setLoading(true);
      // In a real app, this would be an API call
      setTimeout(() => {
        setIntersections(mockIntersections);
        setLoading(false);
      }, 500);
    };

    fetchData();

    // Set up auto-refresh if enabled
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    }

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleEdit = (intersection) => {
    setSelectedIntersection(intersection);
    setEditData({ ...intersection });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    // In a real app, this would be an API call to save changes
    setIntersections(intersections.map(int => 
      int.id === editData.id ? { ...editData } : int
    ));
    setEditDialogOpen(false);
  };

  const handlePhaseChange = (phaseId, field, value) => {
    setEditData(prev => ({
      ...prev,
      phases: prev.phases.map(phase => 
        phase.id === phaseId ? { ...phase, [field]: value } : phase
      )
    }));
  };

  const handleStatusChange = (status) => {
    setEditData(prev => ({
      ...prev,
      status,
      phases: prev.phases.map(phase => ({
        ...phase,
        color: status === 'active' ? (phase.active ? 'green' : 'red') : 'yellow'
      }))
    }));
  };

  const filteredIntersections = intersections.filter(intersection =>
    intersection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    intersection.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTotalCycleTime = (phases) => {
    return phases.reduce((total, phase) => total + phase.duration, 0);
  };

  const getActivePhase = (phases) => {
    return phases.find(phase => phase.active) || phases[0];
  };

  const getNextPhase = (phases) => {
    const activeIndex = phases.findIndex(phase => phase.active);
    return phases[(activeIndex + 1) % phases.length];
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Traffic Light Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="primary"
              />
            }
            label="Auto-refresh"
          />
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              // In a real app, this would open a form to add a new intersection
              alert('Add new intersection functionality would go here');
            }}
          >
            Add Intersection
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            variant="outlined"
            placeholder="Search intersections..."
            size="small"
            value={searchTerm}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300, flex: 1 }}
          />
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value="all"
              onChange={() => {}}
              label="Status"
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="maintenance">Maintenance</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredIntersections.map((intersection) => {
            const activePhase = getActivePhase(intersection.phases);
            const nextPhase = getNextPhase(intersection.phases);
            const totalCycleTime = getTotalCycleTime(intersection.phases);
            
            return (
              <Grid item xs={12} md={6} key={intersection.id}>
                <Card 
                  elevation={2}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: `4px solid ${
                      intersection.status === 'active' ? '#4caf50' :
                      intersection.status === 'maintenance' ? '#ff9800' :
                      '#9e9e9e'
                    }`,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 3,
                    },
                  }}
                >
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <TrafficIcon />
                      </Avatar>
                    }
                    action={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <StatusChip 
                          label={intersection.status} 
                          size="small" 
                          status={intersection.status}
                        />
                        <IconButton 
                          size="small" 
                          onClick={() => handleEdit(intersection)}
                          sx={{ ml: 1 }}
                        >
                          <SettingsIcon />
                        </IconButton>
                      </Box>
                    }
                    title={intersection.name}
                    subheader={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <TimerIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.7 }} />
                        <Typography variant="caption" color="textSecondary">
                          Updated {formatDistanceToNow(intersection.lastUpdated, { addSuffix: true })}
                        </Typography>
                      </Box>
                    }
                  />
                  
                  <CardContent sx={{ pt: 0, flexGrow: 1 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Current Phase
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box sx={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center',
                              mr: 2
                            }}>
                              <Box sx={{ 
                                width: 30, 
                                height: 80, 
                                backgroundColor: '#333', 
                                borderRadius: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                p: 0.5
                              }}>
                                <TrafficLight 
                                  color="red" 
                                  size="small" 
                                  active={activePhase.color === 'red'}
                                />
                                <TrafficLight 
                                  color="yellow" 
                                  size="small" 
                                  active={activePhase.color === 'yellow'}
                                />
                                <TrafficLight 
                                  color="green" 
                                  size="small" 
                                  active={activePhase.color === 'green'}
                                />
                              </Box>
                            </Box>
                            <Box>
                              <Typography variant="h6">
                                {activePhase.name}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {activePhase.duration}s remaining
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Next Phase: {nextPhase.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ width: '100%', mr: 2 }}>
                              <Slider
                                value={activePhase.duration}
                                min={10}
                                max={120}
                                step={5}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(value) => `${value}s`}
                                disabled={intersection.status !== 'active'}
                                onChange={(e, value) => {
                                  // In a real app, this would update the phase duration
                                  console.log(`Set phase duration to ${value} seconds`);
                                }}
                              />
                            </Box>
                            <Typography variant="body2" color="textSecondary">
                              {activePhase.duration}s
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ 
                          p: 1.5, 
                          backgroundColor: '#f5f5f5', 
                          borderRadius: 1,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="subtitle2" color="textSecondary">
                                Cycle Time
                              </Typography>
                              <Typography variant="subtitle2">
                                {totalCycleTime}s
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CarIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                                <Typography variant="body2" color="textSecondary">
                                  Vehicles
                                </Typography>
                              </Box>
                              <Typography variant="body2">
                                {intersection.vehicleCount}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="textSecondary">
                                Avg. Wait Time
                              </Typography>
                              <Typography variant="body2">
                                {intersection.avgWaitTime}s
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Button 
                            variant="outlined" 
                            size="small" 
                            fullWidth
                            sx={{ mt: 2 }}
                            startIcon={<EditIcon />}
                            onClick={() => handleEdit(intersection)}
                          >
                            Configure Phases
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TrafficIcon sx={{ mr: 1 }} />
            {editData?.name || 'Configure Intersection'}
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          {editData && (
            <Box>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editData.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                </Select>
              </FormControl>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2, mb: 1 }}>
                Traffic Light Phases
              </Typography>
              
              {editData.phases.map((phase) => (
                <Paper key={phase.id} sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">{phase.name}</Typography>
                    <Chip 
                      label={phase.active ? 'Active' : 'Inactive'} 
                      size="small" 
                      color={phase.active ? 'success' : 'default'}
                      variant={phase.active ? 'filled' : 'outlined'}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="textSecondary" display="block">
                        Duration (seconds)
                      </Typography>
                      <Slider
                        value={phase.duration}
                        min={5}
                        max={120}
                        step={5}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}s`}
                        onChange={(e, value) => handlePhaseChange(phase.id, 'duration', value)}
                        disabled={editData.status !== 'active'}
                      />
                    </Box>
                    <TextField
                      type="number"
                      value={phase.duration}
                      onChange={(e) => handlePhaseChange(phase.id, 'duration', parseInt(e.target.value) || 0)}
                      variant="outlined"
                      size="small"
                      sx={{ width: 80 }}
                      inputProps={{ min: 5, max: 120, step: 5 }}
                      disabled={editData.status !== 'active'}
                    />
                  </Box>
                </Paper>
              ))}
              
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2">
                  Total Cycle Time: {getTotalCycleTime(editData.phases)} seconds
                </Typography>
                <Box>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small" 
                    startIcon={<AddIcon />}
                    sx={{ mr: 1 }}
                  >
                    Add Phase
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="error" 
                    size="small" 
                    startIcon={<DeleteIcon />}
                    disabled={editData.phases.length <= 2}
                  >
                    Remove Phase
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setEditDialogOpen(false)}
            startIcon={<CloseIcon />}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSave}
            startIcon={<SaveIcon />}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrafficLights;
