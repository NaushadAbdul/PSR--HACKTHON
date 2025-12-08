import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Button,
  InputAdornment,
} from '@mui/material';
import { 
  Search as SearchIcon, 
  FilterList as FilterListIcon,
  MoreVert as MoreVertIcon,
  Image as ImageIcon,
  Warning as WarningIcon,
  DirectionsCar as CarIcon,
  Person as PersonIcon,
  Speed as SpeedIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';

// Mock data - in a real app, this would come from an API
const mockViolations = [
  {
    id: 1,
    type: 'no_helmet',
    licensePlate: 'KA01AB1234',
    location: 'MG Road, Downtown',
    timestamp: new Date('2023-06-15T09:23:17'),
    status: 'pending',
    imageUrl: 'https://via.placeholder.com/150',
    speed: 45,
  },
  {
    id: 2,
    type: 'no_seatbelt',
    licensePlate: 'KA02CD5678',
    location: 'Brigade Road',
    timestamp: new Date('2023-06-15T10:15:42'),
    status: 'processed',
    imageUrl: 'https://via.placeholder.com/150',
    speed: 52,
  },
  {
    id: 3,
    type: 'triple_riding',
    licensePlate: 'KA03EF9012',
    location: 'Indiranagar 100ft Road',
    timestamp: new Date('2023-06-15T11:07:33'),
    status: 'pending',
    imageUrl: 'https://via.placeholder.com/150',
    speed: 48,
  },
  {
    id: 4,
    type: 'wrong_way',
    licensePlate: 'KA04GH3456',
    location: 'Outer Ring Road',
    timestamp: new Date('2023-06-15T12:45:21'),
    status: 'rejected',
    imageUrl: 'https://via.placeholder.com/150',
    speed: 67,
  },
  {
    id: 5,
    type: 'no_helmet',
    licensePlate: 'KA05IJ7890',
    location: 'Koramangala 80ft Road',
    timestamp: new Date('2023-06-15T14:22:10'),
    status: 'processed',
    imageUrl: 'https://via.placeholder.com/150',
    speed: 55,
  },
];

const violationTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'no_helmet', label: 'No Helmet' },
  { value: 'no_seatbelt', label: 'No Seatbelt' },
  { value: 'triple_riding', label: 'Triple Riding' },
  { value: 'wrong_way', label: 'Wrong Way' },
];

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processed', label: 'Processed' },
  { value: 'rejected', label: 'Rejected' },
];

const Violations = () => {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
  });
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  useEffect(() => {
    const fetchViolations = async () => {
      try {
        setLoading(true);
        // In a real app, this would be an API call with filters and pagination
        // const response = await axios.get('/api/violations', { params: { page, rowsPerPage, searchTerm, ...filters } });
        // setViolations(response.data);
        
        // Mock data for now
        setTimeout(() => {
          setViolations(mockViolations);
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching violations:', error);
        setLoading(false);
      }
    };

    fetchViolations();
  }, [page, rowsPerPage, searchTerm, filters]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    setPage(0);
  };

  const handleMenuOpen = (event, violation) => {
    setSelectedViolation(violation);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleViewImage = () => {
    setImageDialogOpen(true);
    handleMenuClose();
  };

  const handleImageDialogClose = () => {
    setImageDialogOpen(false);
  };

  const getViolationLabel = (type) => {
    const v = violationTypes.find(v => v.value === type);
    return v ? v.label : type;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'processed':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getViolationIcon = (type) => {
    switch (type) {
      case 'no_helmet':
        return <PersonIcon />;
      case 'no_seatbelt':
        return <CarIcon />;
      case 'triple_riding':
        return <PersonIcon />;
      case 'wrong_way':
        return <SpeedIcon />;
      default:
        return <WarningIcon />;
    }
  };

  const filteredViolations = violations.filter(violation => {
    const matchesSearch = 
      violation.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      violation.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filters.type === 'all' || violation.type === filters.type;
    const matchesStatus = filters.status === 'all' || violation.status === filters.status;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Traffic Violations
        </Typography>
        <Box>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<FilterListIcon />}
            sx={{ ml: 2 }}
          >
            Export Report
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            variant="outlined"
            placeholder="Search by plate or location..."
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
            sx={{ minWidth: 250, flex: 1 }}
          />
          
          <TextField
            select
            label="Violation Type"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            variant="outlined"
            size="small"
            sx={{ minWidth: 200 }}
          >
            {violationTypes.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          
          <TextField
            select
            label="Status"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            variant="outlined"
            size="small"
            sx={{ minWidth: 150 }}
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {/* Violations Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
          <Table stickyHeader aria-label="violations table">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>License Plate</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Date & Time</TableCell>
                <TableCell>Speed</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    Loading violations...
                  </TableCell>
                </TableRow>
              ) : filteredViolations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    No violations found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredViolations
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((violation) => (
                    <TableRow hover key={violation.id}>
                      <TableCell>#{violation.id}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getViolationIcon(violation.type)}
                          {getViolationLabel(violation.type)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={violation.licensePlate} 
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {violation.location}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {format(violation.timestamp, 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <SpeedIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {violation.speed} km/h
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={violation.status.charAt(0).toUpperCase() + violation.status.slice(1)}
                          color={getStatusColor(violation.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="More actions">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, violation)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredViolations.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Image Dialog */}
      {selectedViolation && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
        >
          <MenuItem onClick={handleViewImage}>
            <ImageIcon sx={{ mr: 1 }} fontSize="small" />
            View Image
          </MenuItem>
          <MenuItem>
            <WarningIcon sx={{ mr: 1 }} fontSize="small" />
            Report Issue
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};

export default Violations;
