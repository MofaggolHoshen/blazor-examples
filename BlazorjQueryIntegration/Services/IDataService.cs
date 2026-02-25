using BlazorjQueryIntegration.Models;

namespace BlazorjQueryIntegration.Services
{
    public interface IDataService
    {
        Task<List<Person>> GetAllPersonsAsync();
        Task<Person?> GetPersonByIdAsync(int id);
        Task<Person> AddPersonAsync(Person person);
        Task<bool> UpdatePersonAsync(Person person);
        Task<bool> DeletePersonAsync(int id);
        Task<int> GetPersonCountAsync();
        Task ClearAllPersonsAsync();
    }
}
