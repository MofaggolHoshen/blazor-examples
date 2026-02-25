using BlazorjQueryIntegration.Models;

namespace BlazorjQueryIntegration.Services
{
    public class DataService : IDataService
    {
        private readonly List<Person> _people = new();
        private readonly Random random = new();
        private int _nextId = 1;

        public DataService()
        {
            PersonSeedData();
        }

        public async Task<List<Person>> GetAllPersonsAsync()
        {
            return await Task.FromResult(new List<Person>(_people));
        }

        public async Task<Person?> GetPersonByIdAsync(int id)
        {
            return await Task.FromResult(_people.FirstOrDefault(p => p.Id == id));
        }

        public async Task<Person> AddPersonAsync(Person person)
        {
            person.Id = _nextId++;
            _people.Add(person);
            return await Task.FromResult(person);
        }

        public async Task<bool> UpdatePersonAsync(Person person)
        {
            var existing = _people.FirstOrDefault(p => p.Id == person.Id);
            if (existing == null)
                return await Task.FromResult(false);

            existing.Name = person.Name;
            existing.Email = person.Email;
            existing.Age = person.Age;
            existing.City = person.City;
            return await Task.FromResult(true);
        }

        public async Task<bool> DeletePersonAsync(int id)
        {
            var person = _people.FirstOrDefault(p => p.Id == id);
            if (person == null)
                return await Task.FromResult(false);

            _people.Remove(person);
            return await Task.FromResult(true);
        }

        public async Task<int> GetPersonCountAsync()
        {
            return await Task.FromResult(_people.Count);
        }

        public async Task ClearAllPersonsAsync()
        {
            _people.Clear();
            _nextId = 1;
            await Task.CompletedTask;
        }

        private void PersonSeedData()
        {
            var firstNames = new[] { "John", "Jane", "Bob", "Alice", "Charlie", "Diana", "Frank", "Grace", "Henry", "Ivy",
                "Michael", "Sarah", "David", "Emma", "James", "Olivia", "Robert", "Sophia", "William", "Ava",
                "Joseph", "Isabella", "Thomas", "Mia", "Charles", "Charlotte", "Daniel", "Amelia", "Matthew", "Harper",
                "Anthony", "Evelyn", "Mark", "Abigail", "Donald", "Emily", "Steven", "Elizabeth", "Paul", "Sofia",
                "Andrew", "Avery", "Joshua", "Ella", "Kenneth", "Scarlett", "Kevin", "Grace", "Brian", "Chloe" };

            var lastNames = new[] { "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
                "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
                "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
                "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts" };

            var cities = new[] { "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose",
                "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte", "San Francisco", "Indianapolis", "Seattle", "Denver", "Washington",
                "Boston", "El Paso", "Nashville", "Detroit", "Oklahoma City", "Portland", "Las Vegas", "Memphis", "Louisville", "Baltimore",
                "Milwaukee", "Albuquerque", "Tucson", "Fresno", "Mesa", "Sacramento", "Atlanta", "Kansas City", "Colorado Springs", "Omaha",
                "Raleigh", "Miami", "Long Beach", "Virginia Beach", "Oakland", "Minneapolis", "Tulsa", "Tampa", "Arlington", "New Orleans" };

            for (int i = 0; i < 10000; i++)
            {
                _people.Add(new Person
                {
                    Id = _nextId++,
                    Name = $"{firstNames[random.Next(firstNames.Length)]} {lastNames[random.Next(lastNames.Length)]}",
                    Email = $"{firstNames[random.Next(firstNames.Length)].ToLower()}.{lastNames[random.Next(lastNames.Length)].ToLower()}{random.Next(1, 999)}@example.com",
                    Age = random.Next(18, 70),
                    City = cities[random.Next(cities.Length)]
                });
            }
        }

    }
}
