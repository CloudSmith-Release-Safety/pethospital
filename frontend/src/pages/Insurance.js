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
  Chip,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Insurance = () => {
  const [policies, setPolicies] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    petName: '',
    petId: '',
    ownerName: '',
    provider: '',
    plan: '',
    startDate: '',
    coverageAmount: 0,
    monthlyPremium: 0
  });
  const [selectedProvider, setSelectedProvider] = useState('');
  const [availablePlans, setAvailablePlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Fetch insurance policies
  useEffect(() => {
    const fetchPolicies = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/insurance');
        setPolicies(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching insurance policies:', err);
        setError('Failed to fetch insurance policies. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, []);

  // Fetch insurance providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await axios.get('/api/insurance/providers');
        setProviders(response.data);
      } catch (err) {
        console.error('Error fetching insurance providers:', err);
        // Fallback to mock data
        setProviders([
          { id: 1, name: 'PetCare Insurance' },
          { id: 2, name: 'Animal Health Insurance' },
          { id: 3, name: 'VetGuard Insurance' },
          { id: 4, name: 'PawProtect' }
        ]);
      }
    };

    fetchProviders();
  }, []);

  // Function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Pending':
        return 'warning';
      case 'Expired':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedProvider('');
    setAvailablePlans([]);
    setNewPolicy({
      petName: '',
      petId: '',
      ownerName: '',
      provider: '',
      plan: '',
      startDate: '',
      coverageAmount: 0,
      monthlyPremium: 0
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewPolicy({
      ...newPolicy,
      [name]: value
    });
  };

  const handleProviderChange = async (e) => {
    const provider = e.target.value;
    setSelectedProvider(provider);
    setNewPolicy({
      ...newPolicy,
      provider: provider,
      plan: '',
      coverageAmount: 0,
      monthlyPremium: 0
    });
    
    // Fetch plans for selected provider
    setLoadingPlans(true);
    try {
      const selectedProviderObj = providers.find(p => p.name === provider);
      if (selectedProviderObj) {
        const response = await axios.get(`/api/insurance/providers/${selectedProviderObj.id}/plans`);
        setAvailablePlans(response.data);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      // Fallback to mock data
      const mockPlans = [
        { id: 1, name: 'Basic', provider: 'PetCare Insurance', coverageAmount: 3000, monthlyPremium: 30 },
        { id: 2, name: 'Standard', provider: 'PetCare Insurance', coverageAmount: 4000, monthlyPremium: 35 },
        { id: 3, name: 'Premium', provider: 'PetCare Insurance', coverageAmount: 5000, monthlyPremium: 45 },
        { id: 4, name: 'Basic', provider: 'Animal Health Insurance', coverageAmount: 3000, monthlyPremium: 30 },
        { id: 5, name: 'Premium', provider: 'Animal Health Insurance', coverageAmount: 5000, monthlyPremium: 40 },
        { id: 6, name: 'Standard', provider: 'VetGuard Insurance', coverageAmount: 4000, monthlyPremium: 38 },
        { id: 7, name: 'Premium', provider: 'VetGuard Insurance', coverageAmount: 6000, monthlyPremium: 50 },
        { id: 8, name: 'Basic', provider: 'PawProtect', coverageAmount: 2500, monthlyPremium: 25 },
        { id: 9, name: 'Premium', provider: 'PawProtect', coverageAmount: 5500, monthlyPremium: 48 }
      ];
      setAvailablePlans(mockPlans.filter(plan => plan.provider === provider));
    } finally {
      setLoadingPlans(false);
    }
  };

  const handlePlanChange = (e) => {
    const planName = e.target.value;
    const selectedPlan = availablePlans.find(plan => plan.name === planName);
    
    if (selectedPlan) {
      setNewPolicy({
        ...newPolicy,
        plan: planName,
        coverageAmount: selectedPlan.coverageAmount,
        monthlyPremium: selectedPlan.monthlyPremium
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const response = await axios.post('/api/insurance', {
        petId: newPolicy.petId,
        petName: newPolicy.petName,
        ownerName: newPolicy.ownerName,
        provider: newPolicy.provider,
        plan: newPolicy.plan,
        startDate: newPolicy.startDate,
        coverageAmount: newPolicy.coverageAmount,
        monthlyPremium: newPolicy.monthlyPremium
      });
      
      setPolicies([...policies, response.data]);
      setSnackbar({
        open: true,
        message: 'Insurance policy created successfully',
        severity: 'success'
      });
      handleClose();
    } catch (err) {
      console.error('Error creating policy:', err);
      setSnackbar({
        open: true,
        message: 'Failed to create insurance policy. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Insurance Policies
        </Typography>
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleOpen}
        >
          Add Policy
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Policy #</TableCell>
                <TableCell>Pet/Owner</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Coverage</TableCell>
                <TableCell>Premium</TableCell>
                <TableCell>Valid Until</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">No insurance policies found</TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell>{policy.policyNumber}</TableCell>
                    <TableCell>
                      <Link to={`/pets/${policy.petId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Typography variant="body2" color="primary" sx={{ fontWeight: 'medium' }}>
                          {policy.petName}
                        </Typography>
                      </Link>
                      <Typography variant="body2" color="textSecondary">
                        Owner: {policy.ownerName}
                      </Typography>
                    </TableCell>
                    <TableCell>{policy.provider}</TableCell>
                    <TableCell>{policy.plan}</TableCell>
                    <TableCell>${policy.coverageAmount.toFixed(2)}</TableCell>
                    <TableCell>${policy.monthlyPremium.toFixed(2)}/month</TableCell>
                    <TableCell>{policy.endDate}</TableCell>
                    <TableCell>
                      <Chip 
                        label={policy.status} 
                        color={getStatusColor(policy.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Button 
                        component={Link}
                        to={`/insurance/${policy.id}`}
                        variant="outlined" 
                        size="small"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Add New Insurance Policy</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              name="petName"
              label="Pet Name"
              fullWidth
              value={newPolicy.petName}
              onChange={handleChange}
            />
            <TextField
              name="petId"
              label="Pet ID"
              fullWidth
              value={newPolicy.petId}
              onChange={handleChange}
            />
            <TextField
              name="ownerName"
              label="Owner Name"
              fullWidth
              value={newPolicy.ownerName}
              onChange={handleChange}
            />
            <FormControl fullWidth>
              <InputLabel>Insurance Provider</InputLabel>
              <Select
                value={selectedProvider}
                onChange={handleProviderChange}
                label="Insurance Provider"
              >
                {providers.map(provider => (
                  <MenuItem key={provider.id} value={provider.name}>
                    {provider.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth disabled={!selectedProvider || loadingPlans}>
              <InputLabel>Plan</InputLabel>
              <Select
                value={newPolicy.plan}
                onChange={handlePlanChange}
                label="Plan"
              >
                {loadingPlans ? (
                  <MenuItem disabled>Loading plans...</MenuItem>
                ) : (
                  availablePlans.map(plan => (
                    <MenuItem key={plan.id} value={plan.name}>
                      {plan.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <TextField
              name="startDate"
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={newPolicy.startDate}
              onChange={handleChange}
            />
            <TextField
              name="coverageAmount"
              label="Coverage Amount ($)"
              type="number"
              fullWidth
              value={newPolicy.coverageAmount}
              InputProps={{ readOnly: true }}
            />
            <TextField
              name="monthlyPremium"
              label="Monthly Premium ($)"
              type="number"
              fullWidth
              value={newPolicy.monthlyPremium}
              InputProps={{ readOnly: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color="primary"
            disabled={!newPolicy.petName || !newPolicy.ownerName || !newPolicy.provider || !newPolicy.plan || !newPolicy.startDate}
          >
            Add Policy
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Insurance;