import axios from 'axios'

const getProjectData = () => axios.get('/api/getProjectData');
const getProjectById = (projectId) => axios.get(`/api/getProjectById/${projectId}`);
const getFieldMetadata = (tableName) => axios.get(`/api/getFieldMetadata/${tableName}`);
const getDataPoints = (moduleName) => axios.get(`/api/getDataPoints/${moduleName}`);
const getFinanceData = (projectId) => axios.get(`/api/getFinanceData/${projectId}`);
const getFinanceSubmodule = (submoduleName, projectId) => axios.get(`/api/getFinanceSubmodule/${submoduleName}/${projectId}`);
const getPerformanceData = (projectId) => axios.get(`/api/getPerformanceData/${projectId}`); 
const updateProjectData = (tableName, projectId, data) => axios.put(`/api/updateProjectData/${tableName}/${projectId}`, data);
const updateFinanceSubmodule = (submoduleName, projectId, data) => axios.put(`/api/updateFinanceSubmodule/${submoduleName}/${projectId}`, data);
const getProjectModule = (moduleName, projectId) => axios.get(`/api/getProjectModule/${moduleName}/${projectId}`);

const getDropdownOptions = (tableName, fieldName) => {    
    const encodedFieldName = fieldName.includes('/') 
    ? encodeURIComponent(encodeURIComponent(fieldName))
    : encodeURIComponent(fieldName);
  return axios.get(`/api/getDropdownOptions/${tableName}/${encodedFieldName}`);
};

const login = (email, password) => axios.post('/api/auth/login', { email, password });

export default {
    getProjectData,
    getProjectById,
    getFieldMetadata,
    getDataPoints,
    getFinanceData,
    getFinanceSubmodule,
    getPerformanceData,
    updateProjectData,
    updateFinanceSubmodule,
    getProjectModule,
    getDropdownOptions,
    login
}