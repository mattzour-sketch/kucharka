import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import TabLayout from './components/TabLayout';
import RecipeListScreen from './features/recipes/RecipeListScreen';
import RecipeEditScreen from './features/recipes/RecipeEditScreen';
import ImportRecipeScreen from './features/recipes/ImportRecipeScreen';
import RecipeDetailScreen from './features/recipes/RecipeDetailScreen';
import RecipeNutritionScreen from './features/recipes/RecipeNutritionScreen';
import CookingModeScreen from './features/recipes/CookingModeScreen';
import SearchScreen from './features/search/SearchScreen';
import FoodsScreen from './features/foods/FoodsScreen';
import FoodEditScreen from './features/foods/FoodEditScreen';
import SettingsScreen from './features/settings/SettingsScreen';
import TrashScreen from './features/trash/TrashScreen';

export default function App() {
  // Base path podle nasazení (GitHub Pages běží na /nazev-repa/, jinak /).
  const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        {/* Obrazovky se spodní lištou. */}
        <Route element={<TabLayout />}>
          <Route path="/" element={<RecipeListScreen />} />
          <Route path="/hledat" element={<SearchScreen />} />
          <Route path="/potraviny" element={<FoodsScreen />} />
          <Route path="/vic" element={<SettingsScreen />} />
        </Route>
        {/* Vysunuté obrazovky bez lišty, s vlastní horní lištou. */}
        <Route path="/novy" element={<RecipeEditScreen />} />
        <Route path="/vlozit" element={<ImportRecipeScreen />} />
        <Route path="/recept/:id" element={<RecipeDetailScreen />} />
        <Route path="/recept/:id/upravit" element={<RecipeEditScreen />} />
        <Route path="/recept/:id/varit" element={<CookingModeScreen />} />
        <Route path="/recept/:id/kalorie" element={<RecipeNutritionScreen />} />
        <Route path="/potraviny/nova" element={<FoodEditScreen />} />
        <Route path="/potraviny/:id/upravit" element={<FoodEditScreen />} />
        <Route path="/kos" element={<TrashScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
