package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.PlansRepository
import `in`.ridepay.app.data.SubscriptionPlan
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SubscriptionUiState(
    val loading: Boolean = true,
    val plans: List<SubscriptionPlan> = emptyList(),
    val myPlanId: String = "free",
    val switching: Boolean = false,
)

@HiltViewModel
class SubscriptionViewModel @Inject constructor(
    private val repository: PlansRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SubscriptionUiState())
    val uiState: StateFlow<SubscriptionUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val plans = repository.listPlans()
            val myPlan = repository.getMyPlan()
            _uiState.update {
                it.copy(
                    loading = false,
                    plans = (plans as? TrpcResult.Success)?.data.orEmpty().filter { p -> p.category == "Individual" && p.active },
                    myPlanId = (myPlan as? TrpcResult.Success)?.data ?: "free",
                )
            }
        }
    }

    fun selectPlan(planId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(switching = true) }
            val result = repository.setMyPlan(planId)
            _uiState.update { it.copy(switching = false, myPlanId = if (result is TrpcResult.Success) planId else it.myPlanId) }
        }
    }
}
