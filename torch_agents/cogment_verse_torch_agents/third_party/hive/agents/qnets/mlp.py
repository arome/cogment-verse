from functools import partial
from cogment_verse_torch_agents.third_party.hive.agents.qnets.noisy_linear import NoisyLinear
import numpy as np
import torch
from torch import nn


class MLPNetwork(nn.Module):
    """Simple MLP function approximator for Q-Learning."""

    def __init__(self, in_dim, hidden_units=256, noisy=False, std_init=0.5):
        super().__init__()
        if isinstance(hidden_units, int):
            hidden_units = [hidden_units]
        linear_fn = partial(NoisyLinear, std_init=std_init) if noisy else nn.Linear
        modules = [linear_fn(np.prod(in_dim), hidden_units[0]), torch.nn.ReLU()]
        for i in range(len(hidden_units) - 1):
            modules.append(linear_fn(hidden_units[i], hidden_units[i + 1]))
            modules.append(torch.nn.ReLU())
        self.network = torch.nn.Sequential(*modules)

    def forward(self, x):
        x = x.float()
        x = torch.flatten(x, start_dim=1)
        return self.network(x)