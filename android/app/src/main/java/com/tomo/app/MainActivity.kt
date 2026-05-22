package com.tomo.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.tomo.app.ui.navigation.Routes
import com.tomo.app.ui.navigation.TomoNavGraph
import com.tomo.app.ui.theme.TomoTheme
import com.tomo.app.viewmodel.MainViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TomoTheme {
                val isOnboarded by viewModel.isOnboarded.collectAsState()
                val navController = rememberNavController()

                TomoNavGraph(
                    navController    = navController,
                    mainViewModel    = viewModel,
                    startDestination = if (isOnboarded) Routes.HOME else Routes.ONBOARDING,
                    modifier         = Modifier.fillMaxSize()
                )
            }
        }
    }
}
