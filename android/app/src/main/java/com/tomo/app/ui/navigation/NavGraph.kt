package com.tomo.app.ui.navigation

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.tomo.app.ui.screens.ChatScreen
import com.tomo.app.ui.screens.HomeScreen
import com.tomo.app.ui.screens.OnboardingScreen
import com.tomo.app.viewmodel.ChatViewModel
import com.tomo.app.viewmodel.MainViewModel

object Routes {
    const val ONBOARDING = "onboarding"
    const val HOME       = "home"
    const val CHAT       = "chat"
}

@Composable
fun TomoNavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
    startDestination: String,
    modifier: Modifier = Modifier
) {
    val chatViewModel: ChatViewModel = viewModel()

    NavHost(
        navController    = navController,
        startDestination = startDestination,
        modifier         = modifier
    ) {
        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                viewModel = mainViewModel,
                onComplete = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.HOME) {
            HomeScreen(
                viewModel   = mainViewModel,
                onOpenChat  = { navController.navigate(Routes.CHAT) }
            )
        }

        composable(Routes.CHAT) {
            ChatScreen(
                mainViewModel = mainViewModel,
                chatViewModel = chatViewModel,
                onBack        = { navController.popBackStack() }
            )
        }
    }
}
