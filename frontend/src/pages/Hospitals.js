import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import { Link } from 'react-router-dom';

// Mock data for hospitals - used as fallback if API fails
const mockHospitals = [
  { id: 1, name: 'Central Pet Hospital', address: '123 Main St, City', phone: '555-1234', specialties: 'General Care, Surgery' },
  { id: 2, name: 'North Animal Clinic', address: '456 Oak Ave, Town', phone: '555-5678', specialties: 'Cardiology, Dermatology' },
  { id: 3, name: 'South Pet Care', address: '789 Pine Rd, Village', phone: '555-9012', specialties: 'Orthopedics, Neurology' },
];

const Hospitals = () => {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [newHospital, setNewHospital] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    specialties: ''
  });

  // Fetch hospitals from API
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/hospital');
        
        if (!response.ok) {
          throw new Error('Failed to fetch hospitals');
        }
        
        const data = await response.json();
        
        // Transform data to match frontend structure if needed
        const formattedHospitals = data.map(hospital => ({
          id: hospital.id,
          name: hospital.name,
          address: hospital.address,
          phone: hospital.phone,
          email: hospital.email || '',
          specialties: hospital.services ? hospital.services.join(', ') : ''
        }));
        
        setHospitals(formattedHospitals);
        setError(null);
      } catch (error) {
        console.error('Error fetching hospitals:', error);
        setError('Failed to load hospitals. Please try again later.');
        // If API fails, use mock data as fallback
        setHospitals(mockHospitals);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHospitals();
  }, []);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewHospital({
      ...newHospital,
      [name]: value
    });
  };

  const handleSubmit = async () => {
    try {
      // Prepare the hospital data according to the backend API requirements
      const hospitalData = {
        name: newHospital.name,
        address: newHospital.address,
        phone: newHospital.phone,
        email: newHospital.email || null,
        services: newHospital.specialties ? newHospital.specialties.split(',').map(s => s.trim()) : []
      };
      
      // Make API call to create hospital
      const response = await fetch('/api/hospital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hospitalData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create hospital');
      }
      
      const createdHospital = await response.json();
      
      // Format the response to match your frontend data structure
      const hospital = {
        id: createdHospital.id,
        name: createdHospital.name,
        address: createdHospital.address,
        phone: createdHospital.phone,
        email: createdHospital.email || '',
        specialties: createdHospital.services ? createdHospital.services.join(', ') : ''
      };
      
      // Update local state
      setHospitals([...hospitals, hospital]);
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Hospital added successfully!',
        severity: 'success'
      });
      
      // Reset form
      setNewHospital({
        name: '',
        address: '',
        phone: '',
        email: '',
        specialties: ''
      });
      handleClose();
      
    } catch (error) {
      console.error('Error creating hospital:', error);
      setSnackbar({
        open: true,
        message: 'Failed to add hospital. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({...snackbar, open: false});
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Hospitals
        </Typography>
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleOpen}
        >
          Add Hospital
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Specialties</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hospitals.map((hospital) => (
                <TableRow key={hospital.id}>
                  <TableCell>{hospital.name}</TableCell>
                  <TableCell>{hospital.address}</TableCell>
                  <TableCell>{hospital.phone}</TableCell>
                  <TableCell>{hospital.email}</TableCell>
                  <TableCell>{hospital.specialties}</TableCell>
                  <TableCell>
                    <Button 
                      component={Link} 
                      to={`/hospital/${hospital.id}`}
                      variant="outlined" 
                      size="small"
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Add New Hospital</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Hospital Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newHospital.name}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            name="address"
            label="Address"
            type="text"
            fullWidth
            variant="outlined"
            value={newHospital.address}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            name="phone"
            label="Phone Number"
            type="text"
            fullWidth
            variant="outlined"
            value={newHospital.phone}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            name="email"
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
            value={newHospital.email}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            name="specialties"
            label="Specialties (comma separated)"
            type="text"
            fullWidth
            variant="outlined"
            value={newHospital.specialties}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">Add</Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Hospitals;
