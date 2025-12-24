using System.Collections.Concurrent;

namespace WebAPI.Services;

/// <summary>
/// Serviço para rastrear conexões SignalR por usuário
/// </summary>
public interface IUserConnectionService
{
    void AddConnection(string userId, string connectionId);
    void RemoveConnection(string userId, string connectionId);
    List<string> GetConnections(string userId);
}

public class UserConnectionService : IUserConnectionService
{
    private readonly ConcurrentDictionary<string, HashSet<string>> _userConnections = new();

    public void AddConnection(string userId, string connectionId)
    {
        _userConnections.AddOrUpdate(
            userId,
            new HashSet<string> { connectionId },
            (key, existingSet) =>
            {
                lock (existingSet)
                {
                    existingSet.Add(connectionId);
                }
                return existingSet;
            });
    }

    public void RemoveConnection(string userId, string connectionId)
    {
        if (_userConnections.TryGetValue(userId, out var connections))
        {
            lock (connections)
            {
                connections.Remove(connectionId);
                if (connections.Count == 0)
                {
                    _userConnections.TryRemove(userId, out _);
                }
            }
        }
    }

    public List<string> GetConnections(string userId)
    {
        if (_userConnections.TryGetValue(userId, out var connections))
        {
            lock (connections)
            {
                return connections.ToList();
            }
        }
        return new List<string>();
    }
}
